// Главная schemehappens.ru для робота без JS (GEO.md): GET / отдаёт index.html
// с текстом лендинга внутри #root. Тест на настоящем express: Host ставится
// явно (правило №19 — визитка на алиасе не получает продуктовый текст), ETag
// и 304 — от res.send, Cache-Control — тот же, что у index.html из ServeStatic.
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homeSeoHtml, homeSeoMiddleware } from './home-seo.middleware';
import { buildHomeBody } from './home-seo.render';
import {
  HOME_FAQ,
  HOME_FEATURES,
  HOME_HERO,
  HOME_STEPS,
  HOME_TRUST,
} from './home-landing.content';
import { esc } from './article-seo.render';
import { REVALIDATE } from '../infra/static-cache';

const BASE = `<!doctype html><html><head><title>t</title></head><body><div id="root"></div><script type="module" src="/a.js"></script></body></html>`;

function buildApp(html: string | null = BASE) {
  const app = express();
  app.get('/{*path}', homeSeoMiddleware(html), (_req, res) => {
    res.send('SPA');
  });
  return app;
}

/** Содержимое #root (до закрывающего </div> перед скриптом сборки). */
const rootOf = (html: string) =>
  /<div id="root">([\s\S]*)<\/div><script/.exec(html)?.[1] ?? '';

describe('homeSeoMiddleware: GET / на хосте приложения', () => {
  const app = buildApp();

  it('текст лендинга лежит внутри #root', async () => {
    const res = await request(app).get('/').set('Host', 'schemehappens.ru');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    const root = rootOf(res.text);
    expect(root).toContain('<h1>Почему со мной снова это');
    expect(root).toContain(esc(HOME_HERO.lead));
    for (const s of HOME_STEPS) expect(root).toContain(esc(s.title));
    for (const f of HOME_FEATURES) expect(root).toContain(esc(f.text));
    for (const t of HOME_TRUST) expect(root).toContain(esc(t.title));
    for (const f of HOME_FAQ) expect(root).toContain(`<h3>${esc(f.q)}</h3>`);
    expect(root).toContain('<a href="/donate">поддержать</a>');
    expect(root).toContain(
      '<a href="https://kotlarewski.gr">сайте практики</a>',
    );
  });

  it('кэш: ревалидация как у index.html, ETag и 304 на повтор', async () => {
    const first = await request(app).get('/').set('Host', 'schemehappens.ru');
    expect(first.headers['cache-control']).toBe(REVALIDATE);
    const etag = first.headers['etag'];
    expect(etag).toBeTruthy();
    const again = await request(app)
      .get('/')
      .set('Host', 'schemehappens.ru')
      .set('If-None-Match', etag);
    expect(again.status).toBe(304);
    expect(again.text).toBe('');
  });

  it('query не мешает: /?utm_source=x — та же главная', async () => {
    const res = await request(app)
      .get('/?utm_source=x')
      .set('Host', 'schemehappens.ru');
    expect(rootOf(res.text)).toContain('<main>');
  });
});

describe('homeSeoMiddleware: всё прочее — дальше, без вложения', () => {
  const app = buildApp();

  it('визитка kotlarewski.gr: главная — своя, продуктовый текст не вкладывается', async () => {
    const res = await request(app).get('/').set('Host', 'kotlarewski.gr');
    expect(res.text).toBe('SPA');
  });

  it('другой путь (кабинет, статьи) — дальше', async () => {
    for (const path of ['/today', '/articles', '/tests']) {
      const res = await request(app).get(path).set('Host', 'schemehappens.ru');
      expect(res.text).toBe('SPA');
    }
  });

  it('нет собранного index.html или #root уже не пустой — дальше', async () => {
    for (const html of [null, BASE.replace('<div id="root"></div>', '')]) {
      const res = await request(buildApp(html))
        .get('/')
        .set('Host', 'schemehappens.ru');
      expect(res.text).toBe('SPA');
    }
  });
});

describe('homeSeoHtml: шов с настоящим index.html', () => {
  it('в webapp/index.html есть пустой #root — вкладывать есть куда', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', 'webapp', 'index.html'),
      'utf8',
    );
    const out = homeSeoHtml(source);
    expect(out).not.toBeNull();
    expect(out).toContain(`<div id="root">${buildHomeBody()}</div>`);
  });
});

describe('buildHomeBody', () => {
  it('без сырых <, кавычек и скриптов из текста: всё экранировано', () => {
    const body = buildHomeBody();
    expect(body).not.toMatch(/<script/i);
    // «Всё по схеме» в кавычках-ёлочках, а не в ASCII — экранировать нечего,
    // но ни одного сырого " вне атрибутов href быть не должно.
    expect(body.replace(/href="[^"]*"/g, '')).not.toContain('"');
    expect(body.startsWith('<main><h1>')).toBe(true);
    expect(body.endsWith('</section></main>')).toBe(true);
  });
});
