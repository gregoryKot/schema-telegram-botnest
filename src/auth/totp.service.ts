import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt, encryptJson, decryptJson } from '../utils/crypto';

const ISSUER = 'SchemaLab';
const RECOVERY_CODES = 10;
const RECOVERY_CODE_BYTES = 5; // 10 hex chars per code

// Allow ±1 step (30s) drift between server and client clock.
authenticator.options = { window: 1 };

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Setup phase ──────────────────────────────────────────────────────────

  // Step 1: user clicks "Enable 2FA". We generate a secret, store it (still
  // un-confirmed — totpEnabledAt stays null), and return the otpauth:// URL
  // + a PNG-data-URL QR code for the authenticator app to scan.
  async startSetup(userId: bigint, accountLabel: string): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    });
    if (user?.totpEnabledAt) throw new ConflictException('2FA already enabled');

    const secret = authenticator.generateSecret();
    const encrypted = encrypt(secret);
    if (!encrypted) throw new Error('Encryption unavailable — refusing to store TOTP secret');

    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { totpSecret: encrypted, totpEnabledAt: null },
    });

    const otpauthUrl = authenticator.keyuri(accountLabel, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
    return { otpauthUrl, qrDataUrl };
  }

  // Step 2: user types their first 6-digit code. If valid → enable 2FA and
  // return a fresh batch of one-time recovery codes (shown ONCE).
  async confirmSetup(userId: bigint, code: string): Promise<{ recoveryCodes: string[] }> {
    const row = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabledAt: true },
    });
    if (!row?.totpSecret) throw new BadRequestException('Setup not started');
    if (row.totpEnabledAt) throw new ConflictException('2FA already enabled');

    const secret = decrypt(row.totpSecret);
    if (!secret) throw new BadRequestException('Setup secret unreadable — restart setup');

    if (!authenticator.check(code.trim(), secret)) {
      throw new UnauthorizedException('Invalid code');
    }

    const codes = Array.from({ length: RECOVERY_CODES }, () =>
      crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex'),
    );
    const hashes = codes.map(hashCode);
    const encryptedHashes = encryptJson(hashes) ?? JSON.stringify(hashes);

    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { totpEnabledAt: new Date(), totpRecoveryCodes: encryptedHashes as any },
    });

    return { recoveryCodes: codes };
  }

  // ─── Verification (login / disable / sensitive action) ───────────────────

  // Verify a TOTP code OR a one-time recovery code against the user's stored
  // secret. Recovery codes are consumed (removed from the list) on success.
  async verifyCode(userId: bigint, code: string): Promise<boolean> {
    const row = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabledAt: true, totpRecoveryCodes: true },
    });
    if (!row?.totpEnabledAt || !row.totpSecret) return false;

    const trimmed = code.trim();
    const secret = decrypt(row.totpSecret);
    if (secret && authenticator.check(trimmed, secret)) return true;

    // Not a valid TOTP — maybe a recovery code.
    const raw = row.totpRecoveryCodes;
    const hashes: string[] = typeof raw === 'string'
      ? (decryptJson<string[]>(raw) ?? [])
      : (Array.isArray(raw) ? raw : []);
    const incomingHash = hashCode(trimmed);
    const idx = hashes.indexOf(incomingHash);
    if (idx === -1) return false;

    // Consume the recovery code.
    const remaining = hashes.filter((_, i) => i !== idx);
    const encryptedRemaining = encryptJson(remaining) ?? JSON.stringify(remaining);
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { totpRecoveryCodes: encryptedRemaining as any },
    });
    this.logger.warn(`Recovery code consumed for user ${userId} (${remaining.length} left)`);
    return true;
  }

  // Disable 2FA — caller must have just verified a current code.
  async disable(userId: bigint, code: string): Promise<void> {
    const ok = await this.verifyCode(userId, code);
    if (!ok) throw new UnauthorizedException('Invalid code');
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabledAt: null, totpRecoveryCodes: [] },
    });
  }

  // Generate a fresh batch of recovery codes, invalidating the old ones.
  async regenerateRecoveryCodes(userId: bigint, code: string): Promise<{ recoveryCodes: string[] }> {
    const ok = await this.verifyCode(userId, code);
    if (!ok) throw new UnauthorizedException('Invalid code');
    const codes = Array.from({ length: RECOVERY_CODES }, () =>
      crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex'),
    );
    const hashes = codes.map(hashCode);
    const encryptedHashes = encryptJson(hashes) ?? JSON.stringify(hashes);
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { totpRecoveryCodes: encryptedHashes as any },
    });
    return { recoveryCodes: codes };
  }

  // Quick read for the login flow — "does this user have 2FA on?".
  async isEnabled(userId: bigint): Promise<boolean> {
    const row = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    });
    return !!row?.totpEnabledAt;
  }

  async getStatus(userId: bigint): Promise<{ enabled: boolean; recoveryCodesLeft: number }> {
    const row = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true, totpRecoveryCodes: true },
    });
    if (!row?.totpEnabledAt) return { enabled: false, recoveryCodesLeft: 0 };
    const raw = row.totpRecoveryCodes;
    const hashes: string[] = typeof raw === 'string'
      ? (decryptJson<string[]>(raw) ?? [])
      : (Array.isArray(raw) ? raw : []);
    return { enabled: true, recoveryCodesLeft: hashes.length };
  }
}
