import { Agent } from 'undici';
import { rootCertificates } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Доверие сертификату MAX — точечно, только для запросов к площадке.
 *
 * У `platform-api2.max.ru` сертификат подписан «Russian Trusted Sub CA», а её
 * корень («Russian Trusted Root CA») не входит ни в один штатный набор
 * доверенных: без него запрос падает на проверке ещё до отправки. Глобальный
 * `NODE_EXTRA_CA_CERTS` решил бы это одной строкой, но расширил бы доверие на
 * ВСЕ исходящие соединения приложения — включая Telegram, Google и БД. Поэтому
 * корень подключается отдельным диспетчером, который видит только адаптер MAX.
 *
 * Корень лежит В РЕПОЗИТОРИИ (`assets/ca/`), а не в env. Через переменную
 * окружения он ехал двое суток и не доехал: панель хостинга по-своему
 * обходится с многострочным значением, а увидеть, что там сохранилось, нельзя
 * — диагностика превращалась в гадание (инцидент 2026-07-31). Корень публичный
 * (его раздают госуслуги), секрета в нём нет, и доверие ему ограничено этим
 * диспетчером. Env остаётся перекрытием — на случай смены корня без деплоя.
 */
const CA_ENV = 'HEALTHY_ADULT_MAX_CA';
const BUNDLED_CA = join(
  process.cwd(),
  'assets',
  'ca',
  'russian-trusted-root.pem',
);

/** Amvera и подобные панели часто сохраняют многострочный PEM с '\n' текстом. */
export function normalizePem(raw: string): string {
  return raw.trim().replace(/\\n/g, '\n');
}

/** Похоже ли значение на PEM-сертификат (иначе доверять нечему). */
export function looksLikePem(value: string): boolean {
  return /-----BEGIN CERTIFICATE-----/.test(value);
}

export interface MaxCa {
  /** Откуда взят корень — это первое, что нужно знать при разборе сбоя. */
  source: 'env' | 'файл' | 'нет';
  pem: string | null;
  /** Кому выдан корень (или почему его не удалось прочитать). */
  subject: string;
}

/**
 * Корень для MAX: сначала env (ручное перекрытие), затем файл из репозитория.
 * PEM тут же разбирается — битое значение отсеивается с внятной причиной, а не
 * доживает до непонятной ошибки TLS.
 */
export function maxCa(): MaxCa {
  const raw = process.env[CA_ENV]?.trim();
  if (raw && looksLikePem(normalizePem(raw))) {
    const pem = normalizePem(raw);
    const subject = describeCert(pem);
    if (subject) return { source: 'env', pem, subject };
    return {
      source: 'нет',
      pem: null,
      subject: `значение ${CA_ENV} не разбирается как сертификат`,
    };
  }
  try {
    const pem = readFileSync(BUNDLED_CA, 'utf8');
    return {
      source: 'файл',
      pem,
      subject: describeCert(pem) ?? 'файл повреждён',
    };
  } catch {
    return { source: 'нет', pem: null, subject: 'корень не найден' };
  }
}

/** Строка «кому выдан» или null, если PEM не разбирается. */
function describeCert(pem: string): string | null {
  try {
    return new X509Certificate(pem).subject.replace(/\n/g, ', ');
  } catch {
    return null;
  }
}

/**
 * Свой корень ДОБАВЛЯЕТСЯ к штатным, а не заменяет их.
 *
 * Инцидент 2026-07-30: `connect: { ca: pem }` в undici — это полная замена
 * списка доверенных корней, а не дополнение. С одним только российским корнем
 * перестают проверяться все остальные цепочки.
 */
export function buildCaBundle(pem: string): string[] {
  return [...rootCertificates, pem];
}

let cached: Agent | null | undefined;

/**
 * Диспетчер для запросов в MAX: с доверенным корнем, если он есть, и
 * `undefined`, если нет — тогда fetch идёт обычным путём.
 */
export function maxDispatcher(): Agent | undefined {
  if (cached !== undefined) return cached ?? undefined;
  const { pem } = maxCa();
  cached = pem ? new Agent({ connect: { ca: buildCaBundle(pem) } }) : null;
  return cached ?? undefined;
}

/** Сброс памяти между тестами: корень читается один раз на процесс. */
export function resetMaxDispatcher(): void {
  cached = undefined;
}
