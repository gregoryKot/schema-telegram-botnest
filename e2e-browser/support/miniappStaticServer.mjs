// Статик-сервер для браузерного смока мини-аппа (miniapp-smoke.spec.ts).
//
// Зачем отдельный файл, а не `vite preview` (как у webapp-проекта): в проде
// мини-апп и сайт — ОДИН ServeStaticModule на webapp/dist (src/app.module.ts,
// rootPath: webapp/dist) — сайт на "/", а schema-miniapp/dist скопирован
// Dockerfile'ом в webapp/dist/app/. index.html мини-аппа ссылается на
// /telegram-web-app.js и /max-bridge.js АБСОЛЮТНЫМ путём от корня — эти файлы
// физически лежат в webapp/public/, не в schema-miniapp/. `vite preview` из
// schema-miniapp обслужил бы только /app/, и оба скрипта 404-ились бы —
// а без настоящего telegram-web-app.js детекция хоста (isTelegramContext,
// см. shared/src/host/telegram.ts) не запустится, и смок не пройдёт именно
// через тот шов, где жил инцидент 2026-08-08 (CLAUDE.md, правило №14).
//
// deploy/front-server.mjs сюда не подходит: это TCP-проброс на порт живого
// Nest-приложения (маскирует окно старта прода страницей техработ), он не
// умеет отдавать файлы с диска — раздавать статику им нечем.
//
// Зависимостей нет намеренно (тот же принцип, что у front-server.mjs):
// встроенные модули Node, ничего не должно уметь больше, чем «отдать файл».
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
// Корень "/" — webapp/public (иконки, telegram-web-app.js, max-bridge.js).
const WEB_PUBLIC = join(ROOT, 'webapp', 'public');
// "/app/" — собранный мини-апп, dist закоммичен в git (CLAUDE.md, «Деплой»).
const MINIAPP_DIST = join(ROOT, 'schema-miniapp', 'dist');

const PORT = Number(process.env.MINIAPP_STATIC_PORT ?? 4174);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Отдаёт файл, если он реально существует внутри своего root'а (без выхода
// за его пределы через "..") — иначе null, вызывающий код решает про 404.
async function tryServe(root, relPath) {
  const filePath = normalize(join(root, relPath));
  if (!filePath.startsWith(root)) return null;
  try {
    const st = await stat(filePath);
    if (!st.isFile()) return null;
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export function startMiniappStaticServer({ port = PORT } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    // relFile — реально резолвленный файл на диске (с index.html для "каталожных"
    // путей); тип контента считаем по НЕМУ, а не по сырому pathname — иначе
    // "/app/" не имеет расширения, Content-Type уезжает в application/octet-stream,
    // и браузер вместо рендеринга HTML предлагает его "скачать".
    let root;
    let relFile;
    if (pathname === '/app' || pathname === '/app/') {
      root = MINIAPP_DIST;
      relFile = 'index.html';
    } else if (pathname.startsWith('/app/')) {
      root = MINIAPP_DIST;
      relFile = pathname.slice('/app/'.length);
    } else {
      root = WEB_PUBLIC;
      relFile = pathname === '/' ? 'index.html' : pathname;
    }

    const body = await tryServe(root, relFile);
    if (!body) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const type = CONTENT_TYPES[extname(relFile)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  });

  server.listen(port, '127.0.0.1', () => {
    console.warn(`[miniapp-static] отдаёт /app/ на порту ${port}`);
  });

  return server;
}

if (process.argv[1] && process.argv[1].endsWith('miniappStaticServer.mjs')) {
  startMiniappStaticServer();
}
