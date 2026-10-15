// Список файлов S3-совместимого бакета (Cloudflare R2) через ListObjectsV2 —
// ответ площадки в XML. Читает его проба самопроверки backupFreshness
// (self-check/probe-backup-freshness.ts). Разбор проверен на ответах из
// документации AWS (test/fixtures/recorded/s3-list-objects-v2-*.xml, правило
// №23); тот же формат разбирает shell-сторона (S3_LIST_JS в scripts/s3-api.sh),
// оба разбора сверяются с одними фикстурами.
import { signRequest, SigV4Credentials, uriEncode } from './s3-sigv4';

export interface S3Object {
  key: string;
  size: number;
  /** ISO-момент из LastModified; пусто, если площадка его не прислала. */
  lastModified: string;
  /** MD5 содержимого для обычной (не multipart) загрузки — без кавычек. */
  etag: string;
}

export interface S3ListPage {
  objects: S3Object[];
  /** Курсор следующей страницы; null — страниц больше нет. */
  nextToken: string | null;
}

export interface S3Config extends SigV4Credentials {
  /** `https://<account>.r2.cloudflarestorage.com` — без бакета в пути. */
  endpoint: string;
  bucket: string;
}

const unescapeXml = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const tag = (xml: string, name: string): string =>
  unescapeXml(
    new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)?.[1] ?? '',
  );

/** Разбор одной страницы ListObjectsV2. Не тот документ — исключение. */
export function parseListObjectsV2(xml: string): S3ListPage {
  if (!/<ListBucketResult[\s>]/.test(xml)) {
    throw new Error(
      'ответ не похож на список файлов S3 (нет ListBucketResult)',
    );
  }
  const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(
    ([, body]) => ({
      key: tag(body, 'Key'),
      size: Number(tag(body, 'Size')),
      lastModified: tag(body, 'LastModified'),
      etag: tag(body, 'ETag').replace(/"/g, ''),
    }),
  );
  const truncated = tag(xml, 'IsTruncated') === 'true';
  const next = tag(xml, 'NextContinuationToken');
  if (truncated && !next) {
    throw new Error('список S3 обрезан, а курсора следующей страницы нет');
  }
  return { objects, nextToken: truncated ? next : null };
}

/** Код ошибки S3 (`SignatureDoesNotMatch`, `NoSuchBucket`…) — без текста: в нём бывают детали запроса. */
const errorCode = (xml: string): string => {
  const code = tag(xml, 'Code');
  return code ? `: ${code.slice(0, 60)}` : '';
};

/** Адрес списка: path-style, параметры уже в каноническом порядке и кодировании. */
export function listUrl(
  cfg: S3Config,
  prefix: string,
  cursor: string | null,
): URL {
  const params = [
    ...(cursor ? [`continuation-token=${uriEncode(cursor)}`] : []),
    'list-type=2',
    `prefix=${uriEncode(prefix)}`,
  ];
  const base = cfg.endpoint.replace(/\/+$/, '');
  return new URL(`${base}/${uriEncode(cfg.bucket)}?${params.join('&')}`);
}

/** Все файлы с префиксом — по страницам. Не дочитал за maxPages — исключение, а не обрезанный список. */
export async function listObjects(
  cfg: S3Config,
  prefix: string,
  deps: { fetchFn?: typeof fetch; maxPages?: number; timeoutMs?: number } = {},
): Promise<S3Object[]> {
  const fetchFn = deps.fetchFn ?? fetch;
  const maxPages = deps.maxPages ?? 20;
  const found: S3Object[] = [];
  // Курсор страницы (continuation-token S3), не секрет и не конфигурация.
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const url = listUrl(cfg, prefix, cursor);
    const res = await fetchFn(url, {
      headers: signRequest({ method: 'GET', url, credentials: cfg }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
    });
    const body = await res.text();
    if (!res.ok)
      throw new Error(`S3 ответил HTTP ${res.status}${errorCode(body)}`);
    const parsed = parseListObjectsV2(body);
    found.push(...parsed.objects);
    cursor = parsed.nextToken;
    if (cursor === null) return found;
  }
  throw new Error(
    `в бакете больше ${maxPages} страниц файлов, список не дочитан`,
  );
}
