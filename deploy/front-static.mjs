// Визитка в окне старта приложения (deploy/front-server.mjs). Пока Nest не
// поднял APP_PORT, front раньше отдавал страницу техработ на любой хост, и
// рекламный клик на kotlarewski.gr попадал в «технические работы» на каждом
// деплое. Первому экрану визитки бэкенд не нужен: это статика webapp/dist, а
// /api/site-content у лендинга с фолбэком на /gregory.jpg. Поэтому здесь front
// читает заголовок запроса и для хоста визитки отдаёт index.html и файлы
// сборки с диска; продукт, API, /app и /health по-прежнему получают техработы.
//
// Только встроенные модули Node: front обязан подниматься при сломанной сборке.
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

/** Хосты визитки — зеркало PRACTICE_ALIAS_HOSTS (src/practice-domain.middleware.ts).
 *  Импортировать TS отсюда нельзя, совпадение держит src/infra/front-server.spec.ts. */
export const VISITKA_HOSTS = new Set(['kotlarewski.gr']);

export const DEFAULT_DIST_DIR = join(
  import.meta.dirname,
  '..',
  'webapp',
  'dist',
);

const HEAD_LIMIT = 16 * 1024;
const HEAD_TIMEOUT_MS = 5000;

// Продуктовые пути и то, что на хосте визитки генерирует сам Nest (sitemap,
// robots — в webapp/dist лежит robots.txt продукта, отдавать его визитке нельзя).
const PRODUCT_PREFIXES = ['/api', '/app', '/health'];
const NEST_ONLY_FILES = new Set(['/robots.txt', '/sitemap.xml']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Сырой HTTP-ответ. Connection: close — ответ самодостаточен. */
export function rawResponse({
  status = 200,
  type,
  body,
  cache,
  omitBody = false,
}) {
  const reason = status === 200 ? 'OK' : 'Not Found';
  const head =
    `HTTP/1.1 ${status} ${reason}\r\n` +
    `Content-Type: ${type}\r\n` +
    `Content-Length: ${body.length}\r\n` +
    `Cache-Control: ${cache}\r\n` +
    'Connection: close\r\n' +
    '\r\n';
  const headBuf = Buffer.from(head, 'utf8');
  return omitBody ? headBuf : Buffer.concat([headBuf, body]);
}

/** Метод, путь без query и хост без порта из заголовка запроса (latin1-текст). */
export function parseRequestHead(text) {
  const [requestLine, ...lines] = text.split('\r\n');
  const [method, target] = requestLine.split(' ');
  if (!method || !target) return null;
  const headers = new Map();
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon > 0) {
      headers.set(
        line.slice(0, colon).trim().toLowerCase(),
        line.slice(colon + 1).trim(),
      );
    }
  }
  // Как req.hostname в Express за доверенным прокси: X-Forwarded-Host, затем Host.
  const rawHost = (
    headers.get('x-forwarded-host') ??
    headers.get('host') ??
    ''
  ).split(',')[0];
  const host = rawHost.trim().toLowerCase().replace(/:\d+$/, '');
  return { method, path: target.split(/[?#]/)[0], host };
}

const isUnder = (path, prefix) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** Файл визитки на диске для запроса или null (тогда — страница техработ). */
export function visitkaResponse(head, distDir = DEFAULT_DIST_DIR) {
  if (!head || !VISITKA_HOSTS.has(head.host)) return null;
  if (head.method !== 'GET' && head.method !== 'HEAD') return null;
  let path;
  try {
    path = decodeURIComponent(head.path);
  } catch {
    return null;
  }
  if (!path.startsWith('/') || path.includes('\0')) return null;
  if (
    PRODUCT_PREFIXES.some((p) => isUnder(path, p)) ||
    NEST_ONLY_FILES.has(path)
  ) {
    return null;
  }
  const omitBody = head.method === 'HEAD';
  const index = readOrNull(join(distDir, 'index.html'));
  if (!index) return null; // сборки нет — честные техработы, а не пустой ответ
  const isAsset = path.slice(path.lastIndexOf('/') + 1).includes('.');
  if (!isAsset) {
    return rawResponse({
      type: TYPES['.html'],
      body: index,
      cache: 'no-store, must-revalidate',
      omitBody,
    });
  }
  const file = join(distDir, normalize(path));
  const body = file.startsWith(distDir + sep) ? readOrNull(file) : null;
  if (!body) {
    return rawResponse({
      status: 404,
      type: TYPES['.txt'],
      body: Buffer.from('Not found'),
      cache: 'no-store',
      omitBody,
    });
  }
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  return rawResponse({ type, body, cache: 'public, no-cache', omitBody });
}

function readOrNull(file) {
  try {
    return statSync(file).isFile() ? readFileSync(file) : null;
  } catch {
    return null;
  }
}

/** Приложение лежит: дочитать заголовок запроса и ответить визиткой или техработами. */
export function answerWhileDown(
  client,
  maintenance,
  distDir = DEFAULT_DIST_DIR,
) {
  let buf = Buffer.alloc(0);
  let done = false;
  const finish = (response) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    client.removeListener('data', onData);
    client.end(response);
  };
  const onData = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const end = buf.indexOf('\r\n\r\n');
    if (end === -1) {
      if (buf.length > HEAD_LIMIT) finish(maintenance);
      return;
    }
    const head = parseRequestHead(buf.subarray(0, end).toString('latin1'));
    finish(visitkaResponse(head, distDir) ?? maintenance);
  };
  const timer = setTimeout(() => finish(maintenance), HEAD_TIMEOUT_MS);
  client.on('data', onData);
  client.on('end', () => finish(maintenance));
  client.on('close', () => clearTimeout(timer));
}
