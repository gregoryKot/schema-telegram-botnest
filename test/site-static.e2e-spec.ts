// Статика сайта через настоящий AppModule (docs/open/ci-tests.md, «e2e не отдаёт
// статику вовсе»). До подмены загрузчика (test/e2e-support/e2e-site-static.ts)
// e2e брал NoopLoader, и SPA-фолбэк, раздачу сборки и 404 по адресам сборки
// держал только src/infra/site-static.spec.ts на отдельном модуле. Здесь — тот
// же AppModule с middleware, фильтрами и helmet, что у прода; корень —
// сборка-фикстура test/fixtures/site-dist.
//
// ADMIN_BOOKING_KEY — до buildTestApp(): ConfigService читает env при сборке
// AppModule. Нужен кейсу «цена из админки → статика без деплоя».
process.env.ADMIN_BOOKING_KEY = 'e2e-site-static-admin-key-0123456789abcdef';

import request from 'supertest';
import { REVALIDATE } from '../src/infra/static-cache';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';

const ADMIN_KEY = process.env.ADMIN_BOOKING_KEY;
const APP_HOST = 'schemehappens.ru';

describe('статика сайта через AppModule', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await buildTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  const http = () => request(t.app.getHttpServer());

  it('путь SPA без файла — index.html (фолбэк), а не 404', async () => {
    const res = await http().get('/today').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('data-e2e-site="1"');
  });

  it('файл сборки — сам файл с годовым кэшем', async () => {
    // .css, а не .js: правило .gitignore `test/**/*.js` не пустило бы фикстуру в git.
    const res = await http().get('/assets/app-E2eFixt1.css').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('промах по адресу сборки — 404 no-store, не HTML', async () => {
    const res = await http().get('/assets/app-Gone1234.css').expect(404);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-type'] ?? '').not.toMatch(/text\/html/);
  });

  it('неизвестная ручка /api — 404 JSON, не страница сайта', async () => {
    const res = await http().get('/api/no-such-route').expect(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.text).not.toContain('data-e2e-site');
  });

  // Правка цены в админке доходит до JSON-LD и llms.txt без деплоя (№4):
  // в файлах сборки — дефолт кода, сервер подставляет цену при отдаче.
  it('сменили цену в админке → index.html, страница визитки и llms.txt с новой', async () => {
    const page = (path: string, host = APP_HOST) =>
      http().get(path).set('Host', host).expect(200);
    expect((await page('/today')).text).toContain('"price": "4000"');

    await http()
      .patch('/api/booking/admin/price')
      .set('Host', APP_HOST)
      .set('x-admin-key', ADMIN_KEY)
      .send({ type: 'SESSION_50', amount: 4500 })
      .expect(200);

    for (const [path, host] of [
      ['/today', APP_HOST], // SPA-фолбэк ServeStatic
      ['/index.html', APP_HOST],
      ['/reviews', 'kotlarewski.gr'], // страница визитки
    ]) {
      const { text } = await page(path, host);
      expect([path, text.includes('"price": "4500"')]).toEqual([path, true]);
      expect([path, text.includes('(50 минут) – 4 500 ₽.')]).toEqual([
        path,
        true,
      ]);
    }
    const llms = await page('/llms.txt');
    expect(llms.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(llms.headers['cache-control']).toBe(REVALIDATE);
    expect(llms.text).toContain('(50 минут, 4 500 ₽)');
  });
});
