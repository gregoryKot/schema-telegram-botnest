// VAPID-ключи уведомлений в приложении (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT; docs/ENV.md). Нет пары ключей — уведомления в приложении
// выключены: GET /api/push/config отдаёт null, очередь их не шлёт, ничего не
// падает. Смена ключей делает мёртвыми ВСЕ подписки: браузер подписан на
// конкретный публичный ключ, людям придётся включить уведомления заново.
import { createECDH } from 'crypto';
import { getVapidHeaders } from 'web-push';

/** Публичный ключ выводится из приватного (P-256) — совпал ли он с заданным.
 *  Зовётся после getVapidHeaders: формат обоих ключей уже проверен. */
function isKeyPair(publicKey: string, privateKey: string): boolean {
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'));
  return ecdh.getPublicKey().equals(Buffer.from(publicKey, 'base64url'));
}

/** Адрес сайта: контакт для push-сервисов, если VAPID_SUBJECT не задан. */
export const DEFAULT_VAPID_SUBJECT = 'https://schemehappens.ru';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export type VapidState =
  | { kind: 'off' }
  | { kind: 'ready'; config: VapidConfig }
  | { kind: 'broken'; problem: string };

// Массив *_ENVS — форма, по которой check-env-registry видит чтение имён:
// функция берёт env параметром (тесты, проба самопроверки).
export const VAPID_ENVS = [
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
] as const;
type Env = Partial<Record<(typeof VAPID_ENVS)[number], string>>;

/**
 * Состояние ключей по env. `broken` — задана половина пары или ключи не
 * проходят проверку web-push (длина, формат, адрес-контакт): включать
 * уведомления с такими ключами нельзя, проба самопроверки скажет почему.
 */
export function readVapid(env: Env = process.env): VapidState {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? '';
  if (!publicKey && !privateKey) return { kind: 'off' };
  if (!publicKey || !privateKey) {
    return {
      kind: 'broken',
      problem: publicKey
        ? 'задан VAPID_PUBLIC_KEY, но нет VAPID_PRIVATE_KEY'
        : 'задан VAPID_PRIVATE_KEY, но нет VAPID_PUBLIC_KEY',
    };
  }
  const subject = env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT;
  try {
    // Та же проверка, что web-push делает перед каждой отправкой: подпись
    // строится сразу, без сети.
    getVapidHeaders(
      'https://fcm.googleapis.com',
      subject,
      publicKey,
      privateKey,
      'aes128gcm',
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: 'broken', problem: `ключи не принимаются: ${msg}` };
  }
  // Подпись строится и чужим приватным ключом, но push-сервис ответит на неё
  // 401/403 — а этот ответ очередь читает как «подписка мертва» и стирает её
  // (push-transport.ts, GONE_STATUSES). Ключи не из одной пары — пуши
  // выключены целиком, подписки людей целы (ревью правил 2026-11-08).
  if (!isKeyPair(publicKey, privateKey)) {
    return {
      kind: 'broken',
      problem: 'VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY не из одной пары',
    };
  }
  return { kind: 'ready', config: { publicKey, privateKey, subject } };
}

let memo: { key: string; state: VapidState } | null = null;

/** readVapid с памятью по значениям env: подпись не строится на каждый вызов. */
export function vapidState(env: Env = process.env): VapidState {
  const key = VAPID_ENVS.map((name) => env[name] ?? '').join('\n');
  if (memo?.key !== key) memo = { key, state: readVapid(env) };
  return memo.state;
}

/** Можно ли сейчас слать уведомления в приложение (ключи заданы и верны). */
export function pushReady(env?: Env): boolean {
  return vapidState(env).kind === 'ready';
}
