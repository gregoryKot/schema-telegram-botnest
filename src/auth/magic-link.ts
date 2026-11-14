// Ссылка привязки почты к аккаунту: одноразовый токен, адрес и отправка письма.
//
// Вынесено из auth.service.ts — тот файл вдвое перерос лимит (правило №10
// CLAUDE.md: раздутый файл дробится, а не пухнет дальше), а этот кусок ни от
// какого другого состояния сервиса не зависит.
//
// В БД уходит только SHA-256 токена: строка из дампа привязать адрес не даёт.
// Адрес шифруется (encField) — это персональные данные. Входа по ссылке на
// почту нет (решение владельца, ч. 10 ст. 8 149-ФЗ): purpose только один.
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
  // Письмо привязки адреса — не «Войти» (аудит 2026-10, A3).
  sendLink: (email: string, link: string, form: AddressForm) => Promise<void>;
  onSendError: (message: string) => void;
}

/** Письмо привязки адреса к аккаунту `userId`; уходит fire-and-forget. */
export async function sendMagicLink(
  deps: MagicLinkDeps,
  userId: bigint,
  lower: string,
): Promise<void> {
  const raw = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  await deps.prisma.emailToken.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      email: deps.encryptEmail(lower),
      purpose: 'link_email_auth',
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    },
  });
  const base = deps.webappUrl.replace(/\/$/, '');
  const query = new URLSearchParams({ token: raw });
  const link = `${base}/api/auth/email/callback?${query.toString()}`;
  const form = await deps.addressForm(userId);
  void deps.sendLink(lower, link, form).catch((err: Error) => {
    deps.onSendError(err.message);
  });
}
