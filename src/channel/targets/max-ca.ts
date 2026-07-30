import { Agent } from 'undici';
import { rootCertificates } from 'node:tls';

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

/**
 * Свой корень ДОБАВЛЯЕТСЯ к штатным, а не заменяет их.
 *
 * Инцидент 2026-07-30: `connect: { ca: pem }` в undici — это полная замена
 * списка доверенных корней, а не дополнение. До подключения своего CA MAX
 * отвечал обычным fetch (штатных корней контейнеру хватало), а с одним только
 * российским корнем цепочка перестала сходиться —
 * UNABLE_TO_GET_ISSUER_CERT_LOCALLY. Поэтому доверяем и системным корням, и
 * тому, что задан в env: какой из них подпишет цепочку, столько и надо.
 */
export function buildCaBundle(pem: string): string[] {
  return [...rootCertificates, pem];
}

let cached: Agent | null | undefined;

/** Задан ли свой корень: от этого зависит, что советовать при сбое TLS. */
export function maxCaConfigured(): boolean {
  const raw = process.env[CA_ENV]?.trim();
  return Boolean(raw && looksLikePem(normalizePem(raw)));
}

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
    pem && looksLikePem(pem)
      ? new Agent({ connect: { ca: buildCaBundle(pem) } })
      : null;
  return cached ?? undefined;
}

/** Сброс памяти между тестами: env читается один раз на процесс. */
export function resetMaxDispatcher(): void {
  cached = undefined;
}
