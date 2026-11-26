// configureSitePages: страницы и файлы, которые сервер отдаёт до ServeStatic,
// читаются из корня сборки ServeStatic и идут с ценой визитки. Консьюмер Nest
// подменён тонким: вешает те же middleware на express в том же порядке.
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { MiddlewareConsumer } from '@nestjs/common';
import { configureSitePages } from './site-pages.routes';
import { PRACTICE_PREVIEW } from './practice-preview';

const PRICED = '<!--landing-price-->';
const landingText = (text: string) => Promise.resolve(text + PRICED);
const INDEX = `<html><head><title>t</title></head><body><div id="root"></div></body></html>`;

function mount(root: string | undefined) {
  const app = express();
  const consumer = {
    apply: (...middleware: express.RequestHandler[]) => ({
      forRoutes: (...routes: { path: string }[]) => {
        for (const { path } of routes) app.get(path, ...middleware);
        return consumer;
      },
    }),
  };
  configureSitePages(
    consumer as unknown as MiddlewareConsumer,
    root,
    landingText,
  );
  app.use((_req, res) => {
    res.send('STATIC');
  });
  return app;
}

describe('configureSitePages', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'site-pages-'));
    writeFileSync(join(root, 'index.html'), INDEX);
    writeFileSync(join(root, 'llms.txt'), 'llms');
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const get = (app: express.Express, path: string, host: string) =>
    request(app).get(path).set('Host', host);

  it('файлы из корня сборки — с ценой визитки', async () => {
    const app = mount(root);
    const llms = await get(app, '/llms.txt', 'schemehappens.ru');
    expect(llms.text).toBe(`llms${PRICED}`);
    const index = await get(app, '/index.html', 'kotlarewski.gr');
    expect(index.text).toBe(`${INDEX}${PRICED}`);
  });

  it('главная: на алиасе — визитка, на хосте приложения — лендинг, обе с ценой', async () => {
    const app = mount(root);
    const practice = await get(app, '/', 'kotlarewski.gr');
    expect(practice.text).toContain(`<title>${PRACTICE_PREVIEW.title}</title>`);
    expect(practice.text.endsWith(PRICED)).toBe(true);
    const product = await get(app, '/', 'schemehappens.ru');
    expect(product.text).toContain('<div id="root"><main>');
    expect(product.text.endsWith(PRICED)).toBe(true);
  });

  it('корня нет (сборки нет) — всё дальше, к ServeStatic', async () => {
    const app = mount(undefined);
    for (const [path, host] of [
      ['/llms.txt', 'schemehappens.ru'],
      ['/', 'kotlarewski.gr'],
      ['/', 'schemehappens.ru'],
    ]) {
      expect([path, host, (await get(app, path, host)).text]).toEqual([
        path,
        host,
        'STATIC',
      ]);
    }
  });
});
