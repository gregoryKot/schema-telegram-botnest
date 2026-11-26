// Какой адрес подписки принимаем: сервер сам делает POST на URL, присланный
// клиентом, — без списка это SSRF (запрос из нашей сети на любой хост, в том
// числе внутренний). Поэтому только https и только хосты push-сервисов
// браузеров; порт и учётные данные в адресе — отказ. Список — по наблюдению:
// чужой хост пишется в лог ИМЕНЕМ (не всем адресом — это секрет человека),
// и по логам его можно добавить, если какой-то браузер ходит через свой
// сервис. Строка про это — docs/SECURITY.md.
import { createHash } from 'crypto';

export const PUSH_SERVICES = ['fcm', 'mozilla', 'apple', 'wns'] as const;
export type PushServiceId = (typeof PUSH_SERVICES)[number];

const EXACT: Record<string, PushServiceId> = {
  'fcm.googleapis.com': 'fcm',
  'android.googleapis.com': 'fcm',
  'updates.push.services.mozilla.com': 'mozilla',
  'web.push.apple.com': 'apple',
};

// Суффикс с точкой впереди: «evilpush.apple.com» сюда не подходит.
const SUFFIXES: Array<[string, PushServiceId]> = [
  ['.push.services.mozilla.com', 'mozilla'],
  ['.push.apple.com', 'apple'],
  ['.notify.windows.com', 'wns'],
];

export type EndpointVerdict =
  | { ok: true; host: string; service: PushServiceId }
  | { ok: false; host: string | null };

/** Разбор адреса подписки: принят ли он и чей это сервис. */
export function checkPushEndpoint(endpoint: string): EndpointVerdict {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, host: null };
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.port !== '') return { ok: false, host };
  if (url.username !== '' || url.password !== '') return { ok: false, host };
  const exact = EXACT[host];
  if (exact) return { ok: true, host, service: exact };
  const hit = SUFFIXES.find(([suffix]) => host.endsWith(suffix));
  return hit ? { ok: true, host, service: hit[1] } : { ok: false, host };
}

/** Сервис по адресу уже сохранённой подписки (для событий аналитики). */
export function pushServiceOf(endpoint: string): PushServiceId | null {
  const v = checkPushEndpoint(endpoint);
  return v.ok ? v.service : null;
}

/** Ключ поиска подписки: sha256 от адреса (сам адрес лежит зашифрованным). */
export function hashEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}
