// Front на публичном порту контейнера (3000). Держит порт с ПЕРВОЙ секунды жизни
// контейнера и до его смерти, поэтому клиент никогда не видит generic-503 самой
// Amvera, пока контейнер жив. Логика на каждое входящее соединение:
//
//   • приложение слушает внутренний APP_PORT → прозрачный TCP-проброс насквозь
//     (без разбора HTTP: keep-alive, chunked, стриминг, большие тела, любые
//     заголовки — всё течёт как есть, ноль риска для боевого трафика);
//   • приложение ещё не подняло APP_PORT (окно старта: recover + migrate + буст
//     Nest) ИЛИ упало/крашлупит → сами отдаём страницу техработ.
//
// Почему front, а не «поднять техработы только при падении» (прежний подход):
// в окне старта порт 3000 был пустым до `app.listen`, и всё это время (десятки
// секунд на migrate deploy) прокси Amvera показывал свой 503. Front закрывает
// это окно — маршрутизирует на приложение ровно тогда, когда оно готово принять
// TCP-соединение (Nest байндит порт последним шагом bootstrap).
//
// Зависимостей нет намеренно: front обязан подниматься, даже если сломана сборка
// или зависимости приложения. Только встроенные модули Node.
//
// Остаётся непокрытым лишь окно пересборки образа при деплое (контейнера ещё нет
// физически) — это уровень платформы, изнутри контейнера недостижимо.
import { createServer as createTcpServer, connect } from 'node:net';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT =
  process.env.PORT !== undefined && process.env.PORT !== ''
    ? Number(process.env.PORT)
    : 3000;
const APP_PORT = Number(process.env.APP_PORT ?? 3001);

// HTML читаем один раз при старте. Если файл почему-то недоступен — не падаем,
// отдаём минимальный встроенный текст (страница техработ важнее красоты).
export function loadMaintenancePage() {
  try {
    return readFileSync(join(import.meta.dirname, 'maintenance.html'), 'utf8');
  } catch {
    return (
      '<!doctype html><meta charset="utf-8"><title>Технические работы</title>' +
      '<body style="font-family:sans-serif;text-align:center;padding:60px">' +
      '<h1>Небольшие технические работы</h1>' +
      '<p>Приложение скоро снова будет доступно.</p>'
    );
  }
}

// Сырой HTTP-ответ страницей техработ. Статус 200 (не 503) — намеренно: если
// прокси Amvera перехватывает 5xx и подменяет своей generic-ошибкой, наша
// страница до пользователя не дойдёт. С 200 прокси гарантированно отдаёт наш
// ответ. Перепроверку доступности делает сама страница (<meta refresh>).
// Connection: close — ответ самодостаточен, читать запрос клиента не требуется.
function maintenanceResponse(bodyBuf) {
  const head =
    'HTTP/1.1 200 OK\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${bodyBuf.length}\r\n` +
    'Cache-Control: no-store, must-revalidate\r\n' +
    'Connection: close\r\n' +
    '\r\n';
  return Buffer.concat([Buffer.from(head, 'utf8'), bodyBuf]);
}

export function startFront({ port = PORT, appPort = APP_PORT } = {}) {
  const bodyBuf = Buffer.from(loadMaintenancePage(), 'utf8');
  const maintenance = maintenanceResponse(bodyBuf);

  const server = createTcpServer((client) => {
    const upstream = connect({ port: appPort, host: '127.0.0.1' });
    let piped = false;
    const killBoth = () => {
      client.destroy();
      upstream.destroy();
    };

    // Сброс соединения любой из сторон не должен ронять процесс и не должен
    // оставлять вторую половину висеть в полуоткрытом состоянии.
    client.on('error', killBoth);

    upstream.on('connect', () => {
      // Приложение готово — прозрачный двунаправленный проброс.
      piped = true;
      client.pipe(upstream);
      upstream.pipe(client);
    });
    upstream.on('error', () => {
      // До connect: приложение не поднято → страница техработ.
      // После connect: обрыв апстрима на лету → закрываем обе стороны.
      if (piped) killBoth();
      else client.end(maintenance);
    });
  });

  // Не удалось занять публичный порт — контейнер бесполезен, пусть перезапустят.
  server.on('error', (err) => {
    console.error(`[front] не удалось поднять front на порту ${port}:`, err);
    process.exit(1);
  });

  server.listen(port, '0.0.0.0', () => {
    const addr = server.address();
    const bound = addr && typeof addr === 'object' ? addr.port : port;
    console.warn(
      `[front] поднят на порту ${bound}, апстрим приложения :${appPort}`,
    );
  });

  return server;
}

// Запуск как отдельного процесса (не при импорте из теста/entrypoint).
if (process.argv[1] && process.argv[1].endsWith('front-server.mjs')) {
  startFront();
}
