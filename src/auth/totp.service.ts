import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt, encryptJson, decryptJson } from '../utils/crypto';

const ISSUER = 'Schema Happens';
const RECOVERY_CODES = 10;
const RECOVERY_CODE_BYTES = 5; // 10 hex chars per code

// Allow ±1 step (30s) drift between server and client clock.
authenticator.options = { window: 1 };

function hashCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code.trim().toLowerCase())
    .digest('hex');
}

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  async confirmSetup(
    userId: bigint,
    code: string,
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

    const codes = Array.from({ length: RECOVERY_CODES }, () =>
      crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex'),
    );
    const hashes = codes.map(hashCode);
    const encryptedHashes = encryptJson(hashes) ?? JSON.stringify(hashes);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabledAt: new Date(),
        totpRecoveryCodes: encryptedHashes,
      },
    });

    return { recoveryCodes: codes };
  }

  // ─── Verification (login / disable / sensitive action) ───────────────────

  // Verify a TOTP code OR a one-time recovery code against the user's stored
  // secret. Recovery codes are consumed (removed from the list) on success.
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
    const secret = decrypt(row.totpSecret);
    if (secret) {
      // Anti-replay (L2 аудита 2026-08): authenticator.check пускал ОДИН и тот
      // же код всё окно валидности (~90с). checkDelta даёт смещение шага, из
      // него — абсолютный time-step принятого кода. Двигаем totpLastStep вперёд
      // АТОМАРНО (updateMany с фильтром lt/null = CAS): повтор того же шага (или
      // более раннего) не проходит условие и получает false.
      const delta = authenticator.checkDelta(trimmed, secret);
      if (delta !== null) {
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
    }

    // Not a valid TOTP — maybe a recovery code.
    const raw = row.totpRecoveryCodes;
    const hashes: string[] =
      typeof raw === 'string'
        ? (decryptJson<string[]>(raw) ?? [])
        : Array.isArray(raw)
          ? raw.map(String)
          : [];
    const incomingHash = hashCode(trimmed);
    const idx = hashes.indexOf(incomingHash);
    if (idx === -1) return false;

    // Consume the recovery code — АТОМАРНО (F1 аудита 2026-08, та же болезнь,
    // что step-ветка выше). Раньше здесь был read→filter→update: два
    // параллельных запроса с ОДНИМ recovery-кодом оба проходили indexOf и оба
    // писали remaining — код гасился дважды (lost-update стирал чужое
    // погашение, одноразовый код срабатывал двумя входами). updateMany с CAS
    // по текущему блобу (equals: raw = jsonb-равенство в Postgres) пускает
    // ровно одну запись: победитель меняет значение, у проигравшего фильтр
    // больше не совпадает (count=0) — код не засчитан.
    // Компромисс: два РАЗНЫХ кода, поданных строго одновременно, тоже
    // конфликтуют по блобу — проигравший получит false и просто повторит ввод
    // (fail-closed, безопасно). Recovery-коды вводит человек по одному, так что
    // гонка — редкость, а двойное списание одноразового кода — нет.
    const remaining = hashes.filter((_, i) => i !== idx);
    const encryptedRemaining =
      encryptJson(remaining) ?? JSON.stringify(remaining);
    const consumed = await this.prisma.user.updateMany({
      where: {
        id: userId,
        totpRecoveryCodes: { equals: raw as Prisma.InputJsonValue },
      },
      data: { totpRecoveryCodes: encryptedRemaining },
    });
    if (consumed.count === 0) return false; // проиграли гонку — код не гасим
    this.logger.warn(
      `Recovery code consumed for user ${userId} (${remaining.length} left)`,
    );
    return true;
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
    const codes = Array.from({ length: RECOVERY_CODES }, () =>
      crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex'),
    );
    const hashes = codes.map(hashCode);
    const encryptedHashes = encryptJson(hashes) ?? JSON.stringify(hashes);
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpRecoveryCodes: encryptedHashes },
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
    const raw = row.totpRecoveryCodes;
    const hashes: string[] =
      typeof raw === 'string'
        ? (decryptJson<string[]>(raw) ?? [])
        : Array.isArray(raw)
          ? raw.map(String)
          : [];
    return { enabled: true, recoveryCodesLeft: hashes.length };
  }
}
