// Подпись запросов AWS Signature Version 4 — ею подписывается каждый запрос
// к S3-совместимому хранилищу бэкапов (Cloudflare R2). Своя реализация, а не
// SDK: пробе самопроверки нужен один GET со списком файлов, а тянуть ради
// него @aws-sdk/client-s3 (десятки пакетов) незачем.
//
// Скрипты бэкапа (scripts/s3-api.sh) подписывают тем же алгоритмом встроенным
// в curl `--aws-sigv4`. Что обе подписи совпадают, проверяет поддельный S3
// (src/test-support/fake-s3.ts): он сверяет подпись настоящего curl этим
// модулем. А сам модуль сверен с опубликованными AWS тест-векторами
// (s3-sigv4.spec.ts) — цепочка замыкается на внешний эталон, а не на себя.
//
// Алгоритм: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
import { createHash, createHmac } from 'crypto';

/** SHA-256 пустого тела — у GET/DELETE без тела. */
export const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface CanonicalInput {
  method: string;
  /** Путь как в запросе (`/bucket/key`). */
  path: string;
  /** Строка запроса с `?` или без; порядок и кодирование не важны. */
  query: string;
  /** Подписываемые заголовки, имена в нижнем регистре (вместе с host и x-amz-date). */
  headers: Record<string, string>;
  payloadHash: string;
  /** `20150830T123600Z`. */
  amzDate: string;
  region: string;
  service: string;
  secretAccessKey: string;
}

export const sha256Hex = (data: string | Buffer): string =>
  createHash('sha256').update(data).digest('hex');

const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data).digest();

/** RFC 3986: всё, кроме `A-Za-z0-9-_.~`, — `%XX` заглавными (требование SigV4). */
export const uriEncode = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** Параметры отсортированы по имени (затем по значению), каждое закодировано заново. */
export function canonicalQuery(query: string): string {
  const pairs = [...new URLSearchParams(query)].map(
    ([k, v]) => [uriEncode(k), uriEncode(v)] as const,
  );
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  pairs.sort(([ak, av], [bk, bv]) => cmp(ak, bk) || cmp(av, bv));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

/** Каждый сегмент пути кодируется один раз (S3 не нормализует путь). */
const canonicalPath = (path: string): string =>
  path
    .split('/')
    .map((seg) => uriEncode(decodeURIComponent(seg)))
    .join('/') || '/';

/** Подпись и её составные части — ровно то, что уходит в заголовок Authorization. */
export function computeSignature(i: CanonicalInput): {
  signature: string;
  signedHeaders: string;
  scope: string;
} {
  const headers = new Map(
    Object.entries(i.headers).map(([k, v]) => [
      k.toLowerCase(),
      String(v).trim().replace(/\s+/g, ' '),
    ]),
  );
  const names = [...headers.keys()].sort();
  const signedHeaders = names.join(';');
  const canonicalRequest = [
    i.method.toUpperCase(),
    canonicalPath(i.path),
    canonicalQuery(i.query),
    names.map((n) => `${n}:${headers.get(n)}\n`).join(''),
    signedHeaders,
    i.payloadHash,
  ].join('\n');
  const day = i.amzDate.slice(0, 8);
  const scope = `${day}/${i.region}/${i.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    i.amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  let key = hmac(`AWS4${i.secretAccessKey}`, day);
  for (const part of [i.region, i.service, 'aws4_request']) {
    key = hmac(key, part);
  }
  return {
    signature: createHmac('sha256', key).update(stringToSign).digest('hex'),
    signedHeaders,
    scope,
  };
}

/** `2015-08-30T12:36:00.000Z` → `20150830T123600Z`. */
export const toAmzDate = (d: Date): string =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/**
 * Заголовки подписанного запроса (без `host` — его ставит сам fetch).
 * Для S3 добавляется обязательный `x-amz-content-sha256`.
 */
export function signRequest(opts: {
  method: string;
  url: URL;
  credentials: SigV4Credentials;
  headers?: Record<string, string>;
  payloadHash?: string;
  service?: string;
  now?: Date;
}): Record<string, string> {
  const service = opts.service ?? 's3';
  const payloadHash = opts.payloadHash ?? EMPTY_SHA256;
  const amzDate = toAmzDate(opts.now ?? new Date());
  const headers: Record<string, string> = {
    ...opts.headers,
    host: opts.url.host,
    'x-amz-date': amzDate,
    ...(service === 's3' ? { 'x-amz-content-sha256': payloadHash } : {}),
  };
  const { signature, signedHeaders, scope } = computeSignature({
    method: opts.method,
    path: opts.url.pathname,
    query: opts.url.search,
    headers,
    payloadHash,
    amzDate,
    region: opts.credentials.region,
    service,
    secretAccessKey: opts.credentials.secretAccessKey,
  });
  const { host: _host, ...rest } = headers;
  return {
    ...rest,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${opts.credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
