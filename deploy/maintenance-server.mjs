// Сервер «технические работы» — поднимается на том же порту 3000, когда основное
// приложение не смогло стартовать (напр. крашлуп на `prisma migrate deploy`,
// инцидент 2026-07-16). Пока контейнер лежит, Amvera показывает свою generic-
// ошибку (платформенной страницы техработ у неё нет) — поэтому дружелюбную
// страницу отдаём сами, изнутри контейнера.
//
// Зависимостей нет намеренно: сервер обязан подниматься даже если сломано что-то
// в сборке/зависимостях приложения. Только встроенные модули Node.
//
// Запускается из Dockerfile CMD как фолбэк:
//   ... migrate deploy && exec node dist/main || exec node deploy/maintenance-server.mjs
// (здоровый путь — exec node dist/main — не меняется; фолбэк срабатывает, только
// если migrate deploy упал и заменить процесс приложением не удалось).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// PORT=0 (эфемерный порт для тестов) — валиден, поэтому отличаем «не задан» от 0.
const PORT =
  process.env.PORT !== undefined && process.env.PORT !== ''
    ? Number(process.env.PORT)
    : 3000;

// HTML читаем один раз при старте. Если файл почему-то недоступен — не падаем,
// отдаём минимальный встроенный текст (страница техработ важнее красоты).
function loadPage() {
  try {
    return readFileSync(join(import.meta.dirname, 'maintenance.html'), 'utf8');
  } catch {
    return '<!doctype html><meta charset="utf-8"><title>Технические работы</title>'
      + '<body style="font-family:sans-serif;text-align:center;padding:60px">'
      + '<h1>Небольшие технические работы</h1>'
      + '<p>Приложение скоро снова будет доступно.</p>';
  }
}

export function startMaintenanceServer(port = PORT) {
  const page = loadPage();
  const body = Buffer.from(page, 'utf8');

  const server = createServer((req, res) => {
    // Любой маршрут (страницы, /app, /api, /health) отвечает страницей техработ.
    // Статус 200 (не 503) — намеренно: если прокси Amvera перехватывает 5xx и
    // подменяет своей generic-ошибкой, страница до пользователя не дойдёт. С 200
    // прокси гарантированно отдаёт наш ответ. Перепроверку доступности делает
    // сама страница (<meta refresh> каждые 30с), а не Retry-After.
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
    });
    // HEAD — только заголовки, без тела.
    if (req.method === 'HEAD') res.end();
    else res.end(body);
  });

  server.listen(port, '0.0.0.0', () => {
    const addr = server.address();
    const bound = addr && typeof addr === 'object' ? addr.port : port;
    console.warn(`[maintenance] страница техработ поднята на порту ${bound}`);
  });

  // PID 1 в контейнере: дефолтного обработчика сигналов нет — вешаем сами,
  // иначе redeploy будет ждать SIGKILL по таймауту.
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

// Запуск как отдельного процесса (Dockerfile CMD), но не при импорте из теста.
if (process.argv[1] && process.argv[1].endsWith('maintenance-server.mjs')) {
  startMaintenanceServer();
}
