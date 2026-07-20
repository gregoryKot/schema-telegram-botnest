import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
// encField/decField: адрес в EmailToken — PII, шифруется (поиск токена идёт
// по tokenHash, не по email, поэтому шифрование лукапы не ломает).
import { encrypt as encField, decrypt as decField } from '../utils/crypto';

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Magic-link email service for recovery + verification.
//
// Sender abstraction: in production uses Resend (https://resend.com — 3000
// free emails/month). For dev/CI without RESEND_API_KEY set, falls back to
// logging the would-be email so you can see the link.
//
// Required env: RESEND_API_KEY, EMAIL_FROM (e.g. "Schema Happens <no-reply@schemehappens.ru>"),
//               WEBAPP_URL.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Send a magic link ────────────────────────────────────────────────────

  async sendRecoveryLink(email: string): Promise<{ ok: true }> {
    if (!isValidEmail(email)) throw new BadRequestException('Invalid email');
    const lower = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { recoveryEmail: lower },
      select: { id: true, recoveryEmailVerifiedAt: true },
    });
    // Pretend success even if no user / unverified — don't leak existence.
    if (!user || !user.recoveryEmailVerifiedAt) {
      this.logger.warn(
        `Recovery requested for ${lower}: ${user ? 'unverified' : 'no match'} (silent)`,
      );
      return { ok: true };
    }

    const raw = crypto.randomBytes(32).toString('base64url');
    await this.prisma.emailToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: hashToken(raw),
        email: encField(lower) ?? lower,
        purpose: 'recovery',
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const link = `${this.config.getOrThrow<string>('WEBAPP_URL')}/auth/recovery/confirm?token=${raw}`;
    await this.send(
      lower,
      'Восстановление доступа к «Всё по схеме»',
      `Перейди по ссылке чтобы войти в свой аккаунт и привязать новый способ входа.\n\n${link}\n\n` +
        `Ссылка действует 30 минут. Если ты не запрашивал восстановление — проигнорируй это письмо.`,
    );
    return { ok: true };
  }

  // Begin email verification — user types address, we send a link.
  async sendVerificationLink(
    userId: bigint,
    email: string,
  ): Promise<{ ok: true }> {
    if (!isValidEmail(email)) throw new BadRequestException('Invalid email');
    const lower = email.toLowerCase().trim();

    const taken = await this.prisma.user.findFirst({
      where: { recoveryEmail: lower, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken)
      throw new ConflictException('Этот email уже привязан к другому аккаунту');

    const raw = crypto.randomBytes(32).toString('base64url');
    await this.prisma.emailToken.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tokenHash: hashToken(raw),
        email: encField(lower) ?? lower,
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const link = `${this.config.getOrThrow<string>('WEBAPP_URL')}/account/verify-email?token=${raw}`;
    await this.send(
      lower,
      'Подтверди email для «Всё по схеме»',
      `Подтверди что это твой адрес — он будет использован для восстановления доступа если ты потеряешь все способы входа.\n\n${link}\n\n` +
        `Ссылка действует 30 минут.`,
    );
    return { ok: true };
  }

  // ─── Consume a magic link ─────────────────────────────────────────────────

  async consumeToken(
    rawToken: string,
    expectedPurpose: 'recovery' | 'verify_email',
  ): Promise<{
    userId: bigint;
    email: string;
  }> {
    if (!rawToken) throw new BadRequestException('Missing token');
    const row = await this.prisma.emailToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!row) throw new UnauthorizedException('Token not found');
    if (row.usedAt) throw new UnauthorizedException('Token already used');
    if (row.expiresAt < new Date())
      throw new UnauthorizedException('Token expired');
    if (row.purpose !== expectedPurpose)
      throw new UnauthorizedException('Token purpose mismatch');
    if (!row.userId)
      throw new UnauthorizedException('Token has no user binding');

    await this.prisma.emailToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    const email = decField(row.email) ?? row.email;
    if (expectedPurpose === 'verify_email') {
      // Bind verified email to user.
      await this.prisma.user.update({
        where: { id: row.userId },
        data: { recoveryEmail: email, recoveryEmailVerifiedAt: new Date() },
      });
    }

    return { userId: row.userId, email };
  }

  // ─── Magic-link login ────────────────────────────────────────────────────

  async sendLoginLink(to: string, link: string): Promise<void> {
    await this.send(
      to,
      'Войти в «Всё по схеме»',
      `Привет!\n\nПерейди по ссылке чтобы войти в «Всё по схеме»:\n\n${link}\n\nСсылка действует 30 минут. Если ты не запрашивал вход — просто проигнорируй это письмо.`,
    );
  }

  // ─── Admin notification (e.g. new booking) ───────────────────────────────

  async sendAdminNotification(subject: string, text: string): Promise<void> {
    const to = process.env.ADMIN_EMAIL;
    if (!to) return; // not configured — skip silently
    await this.send(to, subject, text).catch((err) => {
      this.logger.error(
        `sendAdminNotification failed: ${(err as Error).message}`,
      );
    });
  }

  // ─── Resend SMTP wrapper ──────────────────────────────────────────────────

  private async send(to: string, subject: string, text: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.EMAIL_FROM ?? 'Schema Happens <no-reply@schemehappens.ru>';

    if (!apiKey) {
      // Dev / not-configured — log instead of failing silently.
      this.logger.warn(
        `[DEV: no RESEND_API_KEY] would send to ${to}:\n  Subject: ${subject}\n  Body: ${text}`,
      );
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to, subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `Resend send failed ${res.status}: ${body.slice(0, 200)}`,
        );
        throw new Error('Email delivery failed');
      }
    } catch (e) {
      this.logger.error(`Resend error: ${(e as Error).message}`);
      throw new Error('Email delivery failed', { cause: e });
    }
  }
}
