// llms.txt и прямой /index.html — с ценой визитки из админки, а не файлом с
// диска как есть. Настоящий express, Host — явно (правило №19); путь через
// AppModule и смену цены в админке держит test/site-static.e2e-spec.ts.
import express from 'express';
import request from 'supertest';
import { priceFilesMiddleware } from './price-files';
import { REVALIDATE } from './static-cache';

const PRICED = '<!--landing-price-->';
const landingText = (text: string) => Promise.resolve(text + PRICED);

function buildApp(files: Record<string, string | null>) {
  const app = express();
  app.get('/{*path}', priceFilesMiddleware(files, landingText), (_req, res) => {
    res.send('STATIC');
  });
  return app;
}

describe('priceFilesMiddleware', () => {
  const app = buildApp({ '/llms.txt': 'llms', '/index.html': '<p>html</p>' });

  it('llms.txt — текст с ценой, ревалидация и 304 по ETag содержимого', async () => {
    const res = await request(app)
      .get('/llms.txt')
      .set('Host', 'kotlarewski.gr');
    expect([res.status, res.text]).toEqual([200, `llms${PRICED}`]);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.headers['cache-control']).toBe(REVALIDATE);
    const again = await request(app)
      .get('/llms.txt')
      .set('Host', 'kotlarewski.gr')
      .set('If-None-Match', res.headers.etag);
    expect(again.status).toBe(304);
  });

  it('/index.html — HTML с ценой', async () => {
    const res = await request(app)
      .get('/index.html')
      .set('Host', 'schemehappens.ru');
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.text).toBe(`<p>html</p>${PRICED}`);
  });

  it('файла в сборке нет или путь чужой — дальше, к ServeStatic', async () => {
    const empty = buildApp({ '/llms.txt': null, '/index.html': null });
    for (const [server, path] of [
      [empty, '/llms.txt'],
      [empty, '/index.html'],
      [app, '/robots.txt'],
    ] as const) {
      const res = await request(server)
        .get(path)
        .set('Host', 'schemehappens.ru');
      expect([path, res.text]).toEqual([path, 'STATIC']);
    }
  });
});
