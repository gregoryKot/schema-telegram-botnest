// Ответ с диска, пока Nest не слушает APP_PORT (deploy/front-server.mjs):
// старт контейнера (recover + migrate + буст Nest) и его остановка. Front
// читает заголовок запроса и решает: файл сборки, визитка или техработы.
//
// Файлы сборки — любому хосту. Выкладка на Amvera (замер 2026-11-05,
// docs/RUNBOOKS.md): старый контейнер гасит Nest, ~20 с контейнера нет, новый
// стартует. HTML, пришедший до этого окна, тянет CSS/JS/шрифт уже в окне —
// сюда, пока Nest погашен или стартует. Такой запрос получает файл или 404, но
// не HTML техработ: с nosniff браузер молча выбрасывает стиль или модуль, и
// страница рисуется без стилей (инцидент 2026-11-04). Имени с чужим хешем
// здесь может не быть — тогда 404 с no-store, чтобы промах не закэшировался.
//
// Страницы — только визитке. Рекламный клик на kotlarewski.gr раньше попадал
// в «технические работы» на каждом деплое, а первому экрану визитки бэкенд не
// нужен: это index.html из webapp/dist и /api/site-content у лендинга с
// фолбэком на /gregory.jpg. Страницам продукта (и его .html) бэкенд нужен —
// им, как и API, /app (вечный переход на /today, его делает Nest) и /health,
// по-прежнему техработы.
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
// `/app` — бывший адрес мини-аппа: вечный переход на /today делает Nest
// (src/unified-frontend.middleware.ts); front не должен подменять его index.html.
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

/** Раскодированный путь запроса или null (битое кодирование, \0, не от корня). */
function decodedPath(rawPath) {
  let path;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  return path.startsWith('/') && !path.includes('\0') ? path : null;
}

/** Это отвечает только Nest: продуктовые пути, sitemap и robots. */
const isNestOnly = (path) =>
  PRODUCT_PREFIXES.some((p) => isUnder(path, p)) || NEST_ONLY_FILES.has(path);

/** Файл — точка в последнем сегменте пути; без неё — страница SPA. */
const isFilePath = (path) =>
  path.slice(path.lastIndexOf('/') + 1).includes('.');

/** Страница продукта (путь без точки или .html) — без бэкенда не работает. */
const isProductPage = (path) =>
  !isFilePath(path) || extname(path).toLowerCase() === '.html';

/** Файл из dist или 404 с no-store, но не HTML техработ. */
function fileResponse(distDir, path, omitBody) {
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

/** Ответ с диска, пока Nest лежит, или null (тогда — страница техработ). */
export function staticWhileDown(head, distDir = DEFAULT_DIST_DIR) {
  if (!head || (head.method !== 'GET' && head.method !== 'HEAD')) return null;
  const path = decodedPath(head.path);
  if (!path || isNestOnly(path)) return null;
  const visitka = VISITKA_HOSTS.has(head.host);
  if (!visitka && isProductPage(path)) return null;
  const index = readOrNull(join(distDir, 'index.html'));
  if (!index) return null; // сборки нет — честные техработы, а не пустой ответ
  const omitBody = head.method === 'HEAD';
  if (isFilePath(path)) return fileResponse(distDir, path, omitBody);
  // Страница визитки — её index.html.
  return rawResponse({
    type: TYPES['.html'],
    body: index,
    cache: 'no-store, must-revalidate',
    omitBody,
  });
}

function readOrNull(file) {
  try {
    return statSync(file).isFile() ? readFileSync(file) : null;
  } catch {
    return null;
  }
}

/** Приложение лежит: дочитать заголовок запроса и ответить с диска или техработами. */
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
    finish(staticWhileDown(head, distDir) ?? maintenance);
  };
  const timer = setTimeout(() => finish(maintenance), HEAD_TIMEOUT_MS);
  client.on('data', onData);
  client.on('end', () => finish(maintenance));
  client.on('close', () => clearTimeout(timer));
}
