// Единственный транспорт писем: Yandex Cloud Postbox (российская площадка,
// API совместим с AWS SES v2). Через него идут письма входа и привязки
// адреса, письма владельцу (src/auth/email.service.ts) и резервные алерты
// (src/utils/admin-alert.ts); проба ключа — self-check/probe-postbox.ts.
// Документация: https://yandex.cloud/ru/docs/postbox
//
// Запрос подписывается AWS Signature V4 (регион ru-central1, сервис ses) —
// той же реализацией, что и запросы к хранилищу бэкапов (s3-sigv4.ts, правило
// №3). Ключи — статический ключ доступа сервисного аккаунта с ролью
// postbox.sender. Письма только текстовые.
//
// Без DI (читает env сам): работает и в AlertLogger до подъёма контейнера.
// Сетевой сбой и таймаут пробрасываются — вызывающий пишет их в снимок пробы
// почты (src/utils/alert-email-health.ts).
import { sha256Hex, signRequest, type SigV4Credentials } from './s3-sigv4';

type Env = Record<string, string | undefined>;

export const POSTBOX_SEND_URL =
  'https://postbox.cloud.yandex.net/v2/email/outbound-emails';
export const POSTBOX_REGION = 'ru-central1';
export const POSTBOX_SERVICE = 'ses';
/** Пара ключей подписи: без любого из них письма не уходят. */
export const POSTBOX_ENV_VARS = [
  'POSTBOX_ACCESS_KEY_ID',
  'POSTBOX_SECRET_ACCESS_KEY',
] as const;
/** Один отправитель по умолчанию на письма пользователям и на алерты. */
export const DEFAULT_EMAIL_FROM = 'Schema Happens <no-reply@schemehappens.ru>';
const DEFAULT_TIMEOUT_MS = 10_000;
const ERROR_MAX = 200;

export interface PostboxMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface PostboxOptions {
  timeoutMs?: number;
  /** Момент подписи — фиксируется в тестах. */
  now?: Date;
  credentials?: SigV4Credentials;
}

export interface PostboxResult {
  ok: boolean;
  status: number;
  /** Причина отказа для лога — без секретов и адресов (parsePostboxError). */
  error?: string;
}

/** Ключи подписи из env; null — почта не настроена (нет хотя бы одного). */
export function postboxCredentials(
  env: Env = process.env,
): SigV4Credentials | null {
  const [accessKeyId, secretAccessKey] = POSTBOX_ENV_VARS.map((name) =>
    env[name]?.trim(),
  );
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey, region: POSTBOX_REGION };
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
}

/** «Code: message» из JSON-тела ошибки; null — тело не JSON или форма не та. */
function jsonReason(text: string): string | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null; // не JSON: отказ подписи приходит строкой text/plain
  }
  const { Code, message } = (json ?? {}) as Record<string, unknown>;
  const parts = [Code, message].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  );
  return parts.length > 0 ? parts.join(': ') : null;
}

/**
 * Короткая причина отказа из ответа Postbox. JSON `{Code, message}` (форма из
 * документации) → «Code: message»; не JSON — как пришло (отказ подписи
 * приходит строкой `Forbidden`, text/plain); пусто — «HTTP <статус>». Адреса
 * почты вычёркиваются: текст уходит в лог уровня error, то есть в DM.
 */
export function parsePostboxError(status: number, bodyText: string): string {
  const text = bodyText.trim();
  if (!text) return `HTTP ${status}`;
  return (jsonReason(text) ?? text)
    .replace(/[^\s<>"']+@[^\s<>"']+/g, '<адрес>')
    .slice(0, ERROR_MAX);
}

/**
 * Подписать и отправить JSON-тело на эндпоинт отправки. Общий вход для письма
 * и для пробы ключа: подпись живёт только здесь.
 */
export async function postboxRequest(
  body: unknown,
  opts: PostboxOptions = {},
): Promise<PostboxResult> {
  const credentials = opts.credentials ?? postboxCredentials();
  if (!credentials) throw new Error('Postbox: ключи подписи не заданы');
  const payload = JSON.stringify(body);
  const headers = signRequest({
    method: 'POST',
    url: new URL(POSTBOX_SEND_URL),
    headers: { 'content-type': 'application/json' },
    service: POSTBOX_SERVICE,
    payloadHash: sha256Hex(payload),
    credentials,
    now: opts.now,
  });
  const res = await fetch(POSTBOX_SEND_URL, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (res.ok) return { ok: true, status: res.status };
  const text = await res.text().catch(() => '');
  return {
    ok: false,
    status: res.status,
    error: parsePostboxError(res.status, text),
  };
}

const utf8 = (Data: string) => ({ Data, Charset: 'UTF-8' });

/** Текстовое письмо одному получателю. Успех — HTTP 200 с `MessageId`. */
export function sendPostboxEmail(
  msg: PostboxMessage,
  opts: PostboxOptions = {},
): Promise<PostboxResult> {
  return postboxRequest(
    {
      FromEmailAddress: msg.from,
      Destination: { ToAddresses: [msg.to] },
      Content: {
        Simple: { Subject: utf8(msg.subject), Body: { Text: utf8(msg.text) } },
      },
    },
    opts,
  );
}
