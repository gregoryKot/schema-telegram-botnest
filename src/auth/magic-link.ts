// Магическая ссылка на почту: одноразовый токен, адрес и отправка письма.
//
// Вынесено из auth.service.ts — тот файл вдвое перерос лимит (правило №10
// CLAUDE.md: раздутый файл дробится, а не пухнет дальше), а этот кусок ни от
// какого другого состояния сервиса не зависит.
//
// В БД уходит только SHA-256 токена: строка из дампа войти не даёт. Адрес
// шифруется (encField) — это персональные данные.
import * as crypto from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';
import type { AddressForm } from '../notification/address-form';
// TTL один на все почтовые токены — второй константы рядом быть не должно.
import { EMAIL_TOKEN_TTL_MS } from './email.util';

export interface MagicLinkDeps {
  prisma: PrismaService;
  webappUrl: string;
  encryptEmail: (email: string) => string;
  addressForm: (userId: bigint) => Promise<AddressForm>;
  send: (email: string, link: string, form: AddressForm) => Promise<void>;
  onSendError: (message: string) => void;
}

/**
 * Общий хвост email-логина и привязки email. Письмо уходит fire-and-forget —
 * ответ мгновенный даже при медленной доставке.
 *
 * `ticket` — билет входа. Письмо часто открывают на ДРУГОМ устройстве, и
 * сессия доставалась ему, а исходный экран оставался с надписью «письмо
 * отправлено» навсегда (разбор 2026-08-28).
 */
export async function sendMagicLink(
  deps: MagicLinkDeps,
  userId: bigint,
  lower: string,
  purpose: 'login' | 'link_email_auth',
  ticket?: string,
): Promise<void> {
  const raw = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  await deps.prisma.emailToken.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      email: deps.encryptEmail(lower),
      purpose,
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    },
  });
  const base = deps.webappUrl.replace(/\/$/, '');
  const tail = ticket ? `&ticket=${encodeURIComponent(ticket)}` : '';
  const link = `${base}/api/auth/email/callback?token=${raw}${tail}`;
  const form = await deps.addressForm(userId);
  void deps.send(lower, link, form).catch((err: Error) => {
    deps.onSendError(err.message);
  });
}
