import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProviderHandler, ProviderIdentity } from './types';
import { oauthErrorCode } from '../oauth-error-code';
import { isValidEmail } from '../email.util';

// Яндекс ID (OAuth 2.0, код подтверждения): https://yandex.ru/dev/id/doc/ru/
// Протокол сверен с живой записью 2026-11-12
// (test/fixtures/recorded/yandex-id-oauth.json):
//   - authorize — oauth.yandex.ru/authorize; state возвращается байт в байт,
//     с точками JWT (аналог vk-state.ts не нужен), вместе с code приходит cid;
//   - обмен — POST oauth.yandex.ru/token, тело формой, с client_secret;
//   - профиль — GET login.yandex.ru/info, заголовок `Authorization: OAuth …`
//     (не Bearer, токен не в адресе).
// PKCE нет: клиент конфиденциальный (client_secret), а запрос входа связан с
// браузером подписанным state в куке oauth_state (oauth-host.ts).
// Токены Яндекса не покидают этот файл: exchangeCode берёт из ответа /token
// только access_token и тратит его на один запрос профиля. Они не логируются,
// не сохраняются и не попадают в текст ошибок; refresh-токен не читается вовсе.
const AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize';
const TOKEN_URL = 'https://oauth.yandex.ru/token';
const INFO_URL = 'https://login.yandex.ru/info?format=json';
/** Почта и имя, больше ничего: минимизация, ч. 5 ст. 5 152-ФЗ. */
export const YANDEX_SCOPE = 'login:email login:info';
const TIMEOUT_MS = 10_000;
const NAME_MAX = 64;

type Json = Record<string, unknown>;
const asObject = (body: unknown): Json =>
  body !== null && typeof body === 'object' ? (body as Json) : {};

// Наружу (лог, DM владельцу) — только короткий код площадки: описание ошибки
// целиком в текст не берём (oauth-error-code.ts).
const denied = (step: string, code: unknown, status: number) => {
  const known = typeof code === 'string' ? code.toLowerCase() : code;
  return new UnauthorizedException(
    `Yandex ${step} error: ${oauthErrorCode(known)} (HTTP ${status})`,
  );
};

/** Ответ POST /token → access_token; отказ — исключение с кодом площадки. */
export function parseYandexToken(status: number, body: unknown): string {
  const data = asObject(body);
  const token = data.access_token;
  if (status !== 200 || data.error || typeof token !== 'string' || !token)
    throw denied('token', data.error, status);
  return token;
}

/**
 * Ответ GET /info → личность. Берём только id, default_email и first_name
 * (как у VK — имя без фамилии, S16); login, пол, psuid и emails не читаем.
 * client_id ответа обязан быть нашим: иначе токен выдан чужому приложению.
 */
export function parseYandexProfile(
  status: number,
  body: unknown,
  expectedClientId: string,
): ProviderIdentity {
  const data = asObject(body);
  if (status !== 200) throw denied('profile', data.code, status);
  if (data.client_id !== expectedClientId)
    throw denied('profile', 'client_id_mismatch', status);
  const id = data.id;
  if (typeof id !== 'string' || !/^\d{1,20}$/.test(id))
    throw denied('profile', 'bad_id', status);
  const email =
    typeof data.default_email === 'string'
      ? data.default_email.trim().toLowerCase()
      : '';
  const name =
    typeof data.first_name === 'string' ? data.first_name.trim() : '';
  return {
    providerId: id,
    email: isValidEmail(email) ? email : undefined,
    // По символам, а не по UTF-16: срез не рвёт эмодзи в имени пополам.
    displayName: Array.from(name).slice(0, NAME_MAX).join('') || undefined,
  };
}

/** Тело ответа как JSON; страница ошибки прокси вместо JSON — пустой объект. */
async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {}; // текст разбора мог бы процитировать тело ответа — не берём
  }
}

@Injectable()
export class YandexProvider implements AuthProviderHandler {
  readonly id = 'yandex';
  readonly displayName = 'Яндекс';

  constructor(private readonly config: ConfigService) {}

  // forceChooser — привязка: человек выбирает, КАКОЙ аккаунт Яндекса
  // добавить (force_confirm показывает выбор и подтверждение заново).
  buildAuthUrl(state: string, _nonce?: string, forceChooser?: boolean): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.getOrThrow<string>('YANDEX_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('YANDEX_REDIRECT_URI'),
      scope: YANDEX_SCOPE,
      state,
    });
    if (forceChooser) params.set('force_confirm', 'yes');
    // Пробел в scope — %20, как в записанном запросе (не «+» формы).
    return `${AUTHORIZE_URL}?${params.toString().replace(/\+/g, '%20')}`;
  }

  // Origin адреса возврата — на нём обязана жить кука oauth_state (2026-09-08).
  callbackOrigin(): string {
    return new URL(this.config.getOrThrow<string>('YANDEX_REDIRECT_URI'))
      .origin;
  }

  /**
   * POST /token как есть: статус и тело. Отдельным методом — тот же запрос
   * шлёт проба самопроверки с кодом-пустышкой (probe-yandex-oauth.ts); она
   * читает из тела только код ошибки. Тело удачного обмена несёт токены:
   * вызывающий не логирует его и не отдаёт дальше.
   */
  async requestToken(
    code: string,
    timeoutMs = TIMEOUT_MS,
  ): Promise<{ status: number; body: unknown }> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.getOrThrow<string>('YANDEX_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('YANDEX_CLIENT_SECRET'),
      }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: res.status, body: await readJson(res) };
  }

  async exchangeCode(code: string): Promise<ProviderIdentity> {
    const answer = await this.requestToken(code);
    const token = parseYandexToken(answer.status, answer.body);
    const infoRes = await fetch(INFO_URL, {
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return parseYandexProfile(
      infoRes.status,
      await readJson(infoRes),
      this.config.getOrThrow<string>('YANDEX_CLIENT_ID'),
    );
  }
}
