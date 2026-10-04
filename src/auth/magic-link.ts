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
  // Письмо привязки адреса (link_email_auth) — не «Войти» (аудит 2026-10, A3).
  sendLink: (email: string, link: string, form: AddressForm) => Promise<void>;
  onSendError: (message: string) => void;
}

/**
 * Общий хвост email-логина и привязки email; письмо уходит fire-and-forget.
 * `userId` null — адрес новый: User/AuthProvider до подтверждения не создаём
 * (B-16 аудита 2026-10), аккаунт появится в EmailTokenService.consumeEmailToken.
 * `ticket` — билет входа: письмо часто открывают на ДРУГОМ устройстве, и сессия
 * доставалась ему, а исходный экран висел «письмо отправлено» (2026-08-28).
 */
export async function sendMagicLink(
  deps: MagicLinkDeps,
  userId: bigint | null,
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
  const form = userId === null ? 'ty' : await deps.addressForm(userId);
  const send = purpose === 'link_email_auth' ? deps.sendLink : deps.send;
  void send(lower, link, form).catch((err: Error) => {
    deps.onSendError(err.message);
  });
}
