import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../utils/crypto';
import { revokeOtherSessions } from './session-proof';
import { TotpAttemptsService, TotpLockedException } from './totp-attempts';
import {
  consumeRecoveryCode,
  newRecoveryCodes,
  readRecoveryHashes,
} from './totp-recovery';

const ISSUER = 'Schema Happens';

// Allow ±1 step (30s) drift between server and client clock.
authenticator.options = { window: 1 };

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: TotpAttemptsService,
  ) {}

  // ─── Setup phase ──────────────────────────────────────────────────────────

  // Step 1: user clicks "Enable 2FA". We generate a secret, store it (still
  // un-confirmed — totpEnabledAt stays null), and return the otpauth:// URL
  // + a PNG-data-URL QR code for the authenticator app to scan.
  async startSetup(
    userId: bigint,
    accountLabel: string,
  ): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    });
    if (user?.totpEnabledAt) throw new ConflictException('2FA already enabled');

    const secret = authenticator.generateSecret();
    const encrypted = encrypt(secret);
    if (!encrypted)
      throw new Error('Encryption unavailable — refusing to store TOTP secret');

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encrypted, totpEnabledAt: null },
    });

    const otpauthUrl = authenticator.keyuri(accountLabel, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 240,
      margin: 1,
    });
    return { otpauthUrl, qrDataUrl };
  }

  // Step 2: user types their first 6-digit code. If valid → enable 2FA and
  // return a fresh batch of one-time recovery codes (shown ONCE).
  // S12: включение 2FA гасит остальные сессии — иначе тот, кто увёл сессию
  // раньше, остаётся внутри и после защиты. Семья `currentRefresh` остаётся.
  async confirmSetup(
    userId: bigint,
    code: string,
    currentRefresh?: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabledAt: true },
    });
    if (!row?.totpSecret) throw new BadRequestException('Setup not started');
    if (row.totpEnabledAt) throw new ConflictException('2FA already enabled');

    const secret = decrypt(row.totpSecret);
    if (!secret)
      throw new BadRequestException('Setup secret unreadable — restart setup');

    if (!authenticator.check(code.trim(), secret)) {
      throw new UnauthorizedException('Invalid code');
    }

    const { codes, stored } = newRecoveryCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabledAt: new Date(), totpRecoveryCodes: stored },
    });
    await revokeOtherSessions(this.prisma, userId, currentRefresh);
    return { recoveryCodes: codes };
  }

  // ─── Verification (login / disable / sensitive action) ───────────────────

  // Verify a TOTP code OR a one-time recovery code against the user's stored
  // secret. Recovery codes are consumed on success (totp-recovery.ts).
  // Неверный код — +1 к счётчику аккаунта (S11, totp-attempts.ts); на паузе
  // принимается только резервный код, остальное — 429 `totp_locked`.
  async verifyCode(userId: bigint, code: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totpSecret: true,
        totpEnabledAt: true,
        totpRecoveryCodes: true,
      },
    });
    if (!row?.totpEnabledAt || !row.totpSecret) return false;

    const trimmed = code.trim();
    const lockedFor = await this.attempts.lockedFor(userId);
    const ok =
      (lockedFor === 0 &&
        (await this.checkTotp(userId, row.totpSecret, trimmed))) ||
      (await consumeRecoveryCode(
        this.prisma,
        this.logger,
        userId,
        row.totpRecoveryCodes,
        trimmed,
      ));
    if (ok) return true;
    if (lockedFor > 0) throw new TotpLockedException(lockedFor);
    await this.attempts.recordFailure(userId);
    return false;
  }

  // Anti-replay (L2 аудита 2026-08): authenticator.check пускал ОДИН и тот же
  // код всё окно валидности (~90с). checkDelta даёт смещение шага, из него —
  // абсолютный time-step принятого кода. Двигаем totpLastStep вперёд АТОМАРНО
  // (updateMany с фильтром lt/null = CAS): повтор того же шага (или более
  // раннего) не проходит условие и получает false.
  private async checkTotp(
    userId: bigint,
    storedSecret: string,
    code: string,
  ): Promise<boolean> {
    const secret = decrypt(storedSecret);
    const delta = secret ? authenticator.checkDelta(code, secret) : null;
    if (delta === null) return false;
    const stepSeconds = authenticator.options.step ?? 30;
    const step = Math.floor(Date.now() / 1000 / stepSeconds) + delta;
    const res = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
      },
      data: { totpLastStep: step },
    });
    return res.count > 0;
  }

  // Disable 2FA — caller must have just verified a current code.
  async disable(userId: bigint, code: string): Promise<void> {
    const ok = await this.verifyCode(userId, code);
    if (!ok) throw new UnauthorizedException('Invalid code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabledAt: null, totpRecoveryCodes: [] },
    });
  }

  // Generate a fresh batch of recovery codes, invalidating the old ones.
  async regenerateRecoveryCodes(
    userId: bigint,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const ok = await this.verifyCode(userId, code);
    if (!ok) throw new UnauthorizedException('Invalid code');
    const { codes, stored } = newRecoveryCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpRecoveryCodes: stored },
    });
    return { recoveryCodes: codes };
  }

  // Quick read for the login flow — "does this user have 2FA on?".
  async isEnabled(userId: bigint): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    });
    return !!row?.totpEnabledAt;
  }

  async getStatus(
    userId: bigint,
  ): Promise<{ enabled: boolean; recoveryCodesLeft: number }> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true, totpRecoveryCodes: true },
    });
    if (!row?.totpEnabledAt) return { enabled: false, recoveryCodesLeft: 0 };
    const left = readRecoveryHashes(row.totpRecoveryCodes).length;
    return { enabled: true, recoveryCodesLeft: left };
  }
}
