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
import {
  AddressForm,
  normalizeAddressForm,
} from '../notification/address-form';
import {
  loginLetter,
  recoveryLetter,
  verificationLetter,
} from './email.letters';
import { EMAIL_TOKEN_TTL_MS, hashToken, isValidEmail } from './email.util';

// Magic-link email service (recovery + verification). Prod sender — Resend;
// без RESEND_API_KEY (dev/CI) письмо логируется, чтобы ссылку было видно.
// Env: RESEND_API_KEY, EMAIL_FROM, WEBAPP_URL.
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
      select: { id: true, recoveryEmailVerifiedAt: true, addressForm: true },
    });
    // Pretend success even if no user / unverified — don't leak existence.
    if (!user || !user.recoveryEmailVerifiedAt) {
      // M8 (аудит 2026-07): не логируем сырой адрес — публичный
      // неаутентифицированный эндпоинт, полный email в логах = PII + сбор
      // проверявшихся адресов по логам. Короткий хеш даёт корреляцию
      // (брутфорс одного адреса виден) без раскрытия самого адреса.
      this.logger.warn(
        `Recovery requested (${user ? 'unverified' : 'no match'}) emailHash=${hashToken(
          lower,
        ).slice(0, 12)}`,
      );
      return { ok: true };
    }
    const form = normalizeAddressForm(user.addressForm);

    const raw = crypto.randomBytes(32).toString('base64url');
    await this.prisma.emailToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: hashToken(raw),
        email: encField(lower) ?? lower,
        purpose: 'recovery',
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    const link = `${this.config.getOrThrow<string>('WEBAPP_URL')}/auth/recovery/confirm?token=${raw}`;
    const letter = recoveryLetter(form, link);
    await this.send(lower, letter.subject, letter.body);
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

    // Форма обращения владельца userId — она уже выбрана (бот/сайт), просто
    // не была доступна этому сервису (аудит 2026-08: письма всегда были «ты»).
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { addressForm: true },
    });
    const form = normalizeAddressForm(owner?.addressForm);

    const raw = crypto.randomBytes(32).toString('base64url');
    await this.prisma.emailToken.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tokenHash: hashToken(raw),
        email: encField(lower) ?? lower,
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    const link = `${this.config.getOrThrow<string>('WEBAPP_URL')}/account/verify-email?token=${raw}`;
    const letter = verificationLetter(form, link);
    await this.send(lower, letter.subject, letter.body);
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

  // form: у вызывающего (AuthService) userId уже разрешён (найден или создан)
  // до отправки письма, поэтому форма обращения ему известна — дефолт 'ty'
  // остаётся только на случай вызова без формы (совместимость).
  async sendLoginLink(
    to: string,
    link: string,
    form: AddressForm = 'ty',
  ): Promise<void> {
    const letter = loginLetter(form, link);
    await this.send(to, letter.subject, letter.body);
  }

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
      // M9 (аудит 2026-07): в проде тело письма НЕ логируем — `text` несёт
      // живой magic-link-токен, а .error() уходит ещё и в DM админа. Отсутствие
      // ключа в проде = мисконфиг: громкий алерт без токена/адреса.
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'RESEND_API_KEY not configured — magic-link email NOT sent (misconfiguration)',
        );
        return;
      }
      // Dev / CI — тело можно логировать для локальной проверки ссылки.
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
