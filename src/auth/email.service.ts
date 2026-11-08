import { Injectable, Logger } from '@nestjs/common';
import { AddressForm } from '../notification/address-form';
import * as health from '../utils/alert-email-health';
import { linkEmailLetter } from './email-link.letter';
import { loginLetter } from './email.letters';

// Доставка писем: ссылки входа и привязки адреса (токены — AuthService),
// уведомления владельцу. Prod sender — Resend (RESEND_API_KEY, EMAIL_FROM); без
// ключа (dev/CI) письмо логируется. Ответ Resend — в снимок пробы почты
// (alert-email-health.ts): ключ тот же, что у резервных алертов.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  // form: у вызывающего (AuthService) userId уже разрешён, форма обращения
  // известна — дефолт 'ty' только на случай вызова без формы (совместимость).
  async sendLoginLink(
    to: string,
    link: string,
    form: AddressForm = 'ty',
  ): Promise<void> {
    const letter = loginLetter(form, link);
    await this.send(to, letter.subject, letter.body);
  }

  // Привязка адреса к существующему аккаунту — своё письмо, не «Войти» (A3).
  async sendLinkEmailLetter(
    to: string,
    link: string,
    form: AddressForm = 'ty',
  ): Promise<void> {
    const letter = linkEmailLetter(form, link);
    await this.send(to, letter.subject, letter.body);
  }

  async sendAdminNotification(subject: string, text: string): Promise<boolean> {
    const to = process.env.ADMIN_EMAIL;
    // true = Resend принял письмо. Пустой адрес — warn, не error (№14, без DM).
    if (!to) {
      this.logger.warn(`ADMIN_EMAIL пуст, письмо не ушло: ${subject}`);
      return false;
    }
    return this.send(to, subject, text).catch((err) => {
      this.logger.error(
        `sendAdminNotification failed: ${(err as Error).message}`,
      );
      return false;
    });
  }

  async send(to: string, subject: string, text: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.EMAIL_FROM ?? 'Schema Happens <no-reply@schemehappens.ru>';

    if (!apiKey) {
      // M9 (аудит 2026-07): тело письма НЕ логируем в проде — `text` несёт
      // живой magic-link-токен. Отсутствие ключа тут = мисконфиг: алерт без токена.
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'RESEND_API_KEY not configured — email NOT sent (misconfiguration)',
        );
        return false;
      }
      // Dev / CI — тело можно логировать для локальной проверки ссылки.
      this.logger.warn(
        `[DEV: no RESEND_API_KEY] would send to ${to}:\n  Subject: ${subject}\n  Body: ${text}`,
      );
      return false;
    }

    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to, subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      health.noteAlertEmailError(e);
      this.logger.error(`Resend error: ${(e as Error).message}`);
      throw new Error('Email delivery failed', { cause: e });
    }
    health.noteAlertEmailResponse(res);
    if (res.ok) return true;
    const body = await res.text().catch(() => '');
    this.logger.error(
      `Resend send failed ${res.status}: ${body.slice(0, 200)}`,
    );
    throw new Error('Email delivery failed');
  }
}
