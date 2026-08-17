// Тест статик-сервера браузерного смока мини-аппа
// (e2e-browser/support/miniappStaticServer.mjs) — по образцу
// maxBridgeLoader.test.ts: файл вне наблюдаемых деревьев читается с диска и
// ИСПОЛНЯЕТСЯ (гейт check-unwatched-code.mjs; сам сервер исполняется каждым
// playwright-прогоном как webServer, но гейту нужен тест в vitest/jest-дереве).
//
// Проверяется то, что сломается молча: топология прода (/ → webapp/public,
// /app/ → schema-miniapp/dist) и запрет выхода за корень через "..". Разъедься
// сервер с прод-раскладкой — смок мини-аппа стал бы проверять не тот шов, где
// жил инцидент 2026-08-08 (index.html мини-аппа тянет /telegram-web-app.js
// абсолютным путём от корня).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { startMiniappStaticServer } from '../../e2e-browser/support/miniappStaticServer.mjs';

let server: Server;
let base: string;

beforeAll(async () => {
  server = startMiniappStaticServer({ port: 0 }); // 0 = свободный порт от ОС
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  if (addr === null || typeof addr === 'string') throw new Error('нет порта');
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('miniappStaticServer — топология прод-раздачи для смока', () => {
  it('/app/ отдаёт index.html мини-аппа как text/html (а не скачивание octet-stream)', async () => {
    const res = await fetch(`${base}/app/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    // Абсолютная ссылка от корня — тот самый шов инцидента 2026-08-08.
    expect(html).toContain('/telegram-web-app.js');
  });

  it('корень "/" раздаёт webapp/public: /telegram-web-app.js доехал как javascript', async () => {
    const res = await fetch(`${base}/telegram-web-app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect((await res.text()).length).toBeGreaterThan(1000);
  });

  it('выход за корень через ".." закрыт — 404, а не содержимое репозитория', async () => {
    // encodeURIComponent, чтобы ".." дошёл до сервера, а не съелся клиентом.
    const res = await fetch(`${base}/app/${encodeURIComponent('..')}/${encodeURIComponent('..')}/package.json`);
    expect(res.status).toBe(404);
  });

  it('неизвестный путь — честный 404, не index.html (это не SPA-fallback-сервер)', async () => {
    const res = await fetch(`${base}/app/no-such-file.js`);
    expect(res.status).toBe(404);
  });
});
