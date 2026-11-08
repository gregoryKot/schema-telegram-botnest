// Статика сайта через настоящий AppModule (docs/open/ci-tests.md, «e2e не отдаёт
// статику вовсе»). До подмены загрузчика (test/e2e-support/e2e-site-static.ts)
// e2e брал NoopLoader, и SPA-фолбэк, раздачу сборки и 404 по адресам сборки
// держал только src/infra/site-static.spec.ts на отдельном модуле. Здесь — тот
// же AppModule с middleware, фильтрами и helmet, что у прода; корень —
// сборка-фикстура test/fixtures/site-dist.
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';

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
});
