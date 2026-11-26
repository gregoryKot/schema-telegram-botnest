'use strict';
// Подпись запросов AWS Signature Version 4 к S3-совместимому хранилищу
// бэкапов (Yandex Object Storage) — единственная реализация в репозитории (правило
// №3). Чистый Node без зависимостей и сборки: приложение берёт её через
// src/infra/s3-sigv4.ts (проба backupFreshness), скрипты бэкапа — как CLI из
// scripts/s3-api.sh. В образе файл лежит в /app/deploy/ (копируется целиком).
//
// Не `curl --aws-sigv4`: curl каноникализирует строку запроса сам, и curl
// 8.14+ (Ubuntu 26.04 — 8.18) подписывает `%2B` как `%20`, а AWS и S3-совместимые хранилища — как
// `%2B`: страница листинга с `+` в курсоре получала 403 SignatureDoesNotMatch.
// Эталоны (AWS, документация S3, botocore) — src/infra/s3-sigv4.spec.ts, CLI —
// src/infra/s3-sign-cli.spec.ts. Алгоритм:
// https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
//
// CLI: node deploy/s3-sign.cjs <метод> <адрес> <sha256 тела> <регион>; stdin —
// ключ доступа и секрет двумя строками (не аргументами: их видно в ps); stdout —
// строки конфига curl для `-K -`; ошибка — код 2 и причина без секретов в stderr.
const { createHash, createHmac } = require('crypto');

/** SHA-256 пустого тела — у GET/DELETE без тела. */
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** RFC 3986: всё, кроме `A-Za-z0-9-_.~`, — `%XX` заглавными (требование SigV4). */
const uriEncode = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Параметры отсортированы по имени (затем по значению), каждое декодировано и
 * закодировано заново: `%2B` остаётся `%2B`. Голый `+` читается как пробел
 * (правила формы) — клиент обязан слать `%2B`.
 */
function canonicalQuery(query) {
  const pairs = [...new URLSearchParams(query)].map(([k, v]) => [uriEncode(k), uriEncode(v)]);
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  pairs.sort(([ak, av], [bk, bv]) => cmp(ak, bk) || cmp(av, bv));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

/** Каждый сегмент пути кодируется один раз (S3 не нормализует путь). */
const canonicalPath = (path) =>
  path.split('/').map((seg) => uriEncode(decodeURIComponent(seg))).join('/') || '/';

/** Подпись и её составные части — ровно то, что уходит в заголовок Authorization. */
function computeSignature(i) {
  const headers = new Map(
    Object.entries(i.headers).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')]),
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
  const stringToSign = ['AWS4-HMAC-SHA256', i.amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  let key = hmac(`AWS4${i.secretAccessKey}`, day);
  for (const part of [i.region, i.service, 'aws4_request']) key = hmac(key, part);
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex');
  return { signature, signedHeaders, scope };
}

/** `2015-08-30T12:36:00.000Z` → `20150830T123600Z`. */
const toAmzDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Заголовки подписанного запроса (без `host` — его ставит сам клиент по
 * адресу). Для S3 добавляется обязательный `x-amz-content-sha256`.
 */
function signRequest(opts) {
  const service = opts.service ?? 's3';
  const payloadHash = opts.payloadHash ?? EMPTY_SHA256;
  const amzDate = toAmzDate(opts.now ?? new Date());
  const headers = {
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

/** Строка конфига curl (-K): значение в кавычках, `\` и `"` экранированы. */
const curlHeader = (name, value) =>
  `header = "${`${name}: ${value}`.replace(/[\\"]/g, (c) => `\\${c}`)}"`;

function cli(argv, stdin) {
  const [method, url, payloadHash, region] = argv;
  if (!/^[A-Z]+$/.test(method ?? '') || !url || !region)
    throw new Error('ожидается: <метод> <адрес> <sha256 тела> <регион>');
  if (!/^([0-9a-f]{64}|UNSIGNED-PAYLOAD)$/.test(payloadHash ?? ''))
    throw new Error('sha256 тела — 64 шестнадцатеричных символа');
  const [accessKeyId, secretAccessKey] = stdin.split(/\r?\n/);
  if (!accessKeyId || !secretAccessKey)
    throw new Error('в stdin нет ключа доступа и секрета (две строки)');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('адрес хранилища не разобрать');
  }
  const credentials = { accessKeyId, secretAccessKey, region };
  const headers = signRequest({ method, url: parsed, credentials, payloadHash });
  return Object.entries(headers).map(([k, v]) => `${curlHeader(k, v)}\n`).join('');
}

if (require.main === module) {
  try {
    const stdin = require('fs').readFileSync(0, 'utf8');
    process.stdout.write(cli(process.argv.slice(2), stdin));
  } catch (e) {
    process.stderr.write(`s3-sign: ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = {
  EMPTY_SHA256, sha256Hex, uriEncode, canonicalQuery, computeSignature, toAmzDate, signRequest,
};
