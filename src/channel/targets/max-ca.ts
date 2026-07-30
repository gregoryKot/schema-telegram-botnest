import { Agent } from 'undici';

/**
 * Доверие сертификату MAX — точечно, только для запросов к площадке.
 *
 * После переезда на platform-api2 у MAX сертификат российского УЦ, которого нет
 * в доверенных ни у macOS, ни у Node: без него публикация падает на проверке
 * сертификата ещё до отправки. Глобальный `NODE_EXTRA_CA_CERTS` решил бы это
 * одной строкой, но расширил бы доверие на ВСЕ исходящие соединения
 * приложения — включая Telegram, Google и БД. Поэтому корневой сертификат
 * подключается отдельным диспетчером, который видит только адаптер MAX.
 *
 * Сам сертификат живёт в env `HEALTHY_ADULT_MAX_CA` (репозиторий публичный, и
 * держать в нём государственный корневой сертификат незачем). Env принимает
 * PEM как есть — многострочный или с экранированными переводами строк.
 */
const CA_ENV = 'HEALTHY_ADULT_MAX_CA';

/** Amvera и подобные панели часто сохраняют многострочный PEM с '\n' текстом. */
export function normalizePem(raw: string): string {
  return raw.trim().replace(/\\n/g, '\n');
}

/** Похоже ли значение на PEM-сертификат (иначе доверять нечему). */
export function looksLikePem(value: string): boolean {
  return /-----BEGIN CERTIFICATE-----/.test(value);
}

let cached: Agent | null | undefined;

/**
 * Диспетчер для запросов в MAX: с доверенным сертификатом, если он задан, и
 * `undefined`, если нет — тогда fetch идёт обычным путём (вдруг сертификат
 * площадки уже стал доверенным сам по себе).
 */
export function maxDispatcher(): Agent | undefined {
  if (cached !== undefined) return cached ?? undefined;
  const raw = process.env[CA_ENV]?.trim();
  const pem = raw ? normalizePem(raw) : '';
  cached =
    pem && looksLikePem(pem) ? new Agent({ connect: { ca: pem } }) : null;
  return cached ?? undefined;
}

/** Сброс памяти между тестами: env читается один раз на процесс. */
export function resetMaxDispatcher(): void {
  cached = undefined;
}
