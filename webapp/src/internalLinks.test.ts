// Внутренние ссылки ведут на маршрут App.tsx или файл public/ (№14): экран 404 отчёт не шлёт.
// Хост в тесте неизвестен — сверка с appRoutes ∪ personalRoutes; путь из переменной не виден.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { routePaths, routeTableBlock } from './test-support/appRoutes';

const DYN = '*';

/** Конец первого аргумента с позиции `start`: запятая или закрывающая скобка на нулевой глубине. */
function firstArgEnd(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch) && depth-- === 0) return i;
    else if (ch === ',' && depth === 0) return i;
  }
  return src.length;
}

const PATH_LITERAL = /(['"`])(\/(?:(?!\1)[^\\\n])*)\1/g;
const STRING_ATTR = /\b(?:href|to)=(["'])(\/[^"'\n]*)\1/g;
const STRING_PROP = /\b(?:href|to)\s*:\s*(['"`])(\/(?:(?!\1)[^\\\n])*)\1/g;
const EXPRESSION_START = /\b(?:href|to)=\{|\bnavigate\(|\blocation\.(?:assign|replace)\(/g;

/** Литералы путей: href/to (атрибут JSX и поле объекта), navigate(…), location.assign/replace(…). */
function linkLiterals(src: string): string[] {
  const out = [...src.matchAll(STRING_ATTR), ...src.matchAll(STRING_PROP)].map((m) => m[2]);
  for (const m of src.matchAll(EXPRESSION_START)) {
    const start = m.index + m[0].length;
    const arg = src.slice(start, firstArgEnd(src, start));
    out.push(...[...arg.matchAll(PATH_LITERAL)].map((l) => l[2]));
  }
  return out;
}

/** Ссылка жива: маршрут (`:param` и подстановка `${…}` — любой сегмент) или файл public/;
 *  внешние, относительные, якоря и /api/* — вне сверки. */
function isLinkAlive(link: string, routes: string[], publicFiles: ReadonlySet<string>): boolean {
  if (!link.startsWith('/') || link.startsWith('//')) return true;
  const path = link.replace(/\$\{[^}]*\}/g, DYN).replace(/[?#].*$/, '').replace(/(.)\/$/, '$1');
  if (path === '/api' || path.startsWith('/api/') || publicFiles.has(path.slice(1))) return true;
  const segs = path.split('/');
  const fits = (part: string, seg: string) =>
    seg.includes(DYN) ? part !== '' : part.startsWith(':') ? seg !== '' : part === seg;
  return routes.some((route) => {
    const parts = route.split('/');
    return parts.length === segs.length && parts.every((part, i) => fits(part, segs[i]));
  });
}

describe('сверка ссылок (самопроверка)', () => {
  const routes = ['/', '/articles/:slug', '/today', '/login'];
  const files = new Set(['llms.txt', 'fonts/a.woff2']);
  const alive = (link: string) => isLinkAlive(link, routes, files);

  it('живое: маршрут, параметр, подстановка, якорь, запрос, файл public/, внешнее и /api/*', () => {
    const links = [
      '/', '/#booking', '/articles/x', '/articles/${a.slug}', '/${tab}', '/login?error=no_token', '/today/',
      '/llms.txt', '/fonts/a.woff2', 'https://t.me/x', 'mailto:a@b.c', '#top', '//cdn.x/y', '/api/whatever',
    ];
    expect(links.filter((l) => !alive(l))).toEqual([]);
  });

  it('битое: опечатка, лишний или пустой сегмент, нет файла', () => {
    const links = ['/artciles/x', '/today/extra', '/articles/', '/articles', '/llms2.txt', '/fonts'];
    expect(links.filter(alive)).toEqual([]);
  });

  it('берёт литералы из href/to, navigate(…) и location.assign(…), пропуская параметры вызова', () => {
    const src = [
      '<a href="/privacy#cookies">',
      '<Link to={`/articles/${a.slug}`} />',
      "navigate(x ? '/today' : '/login?error=1', { state: { from: '/skip' } })",
      "const nav = [{ href: '/reviews' }, { to: '/more' }];",
      '<a href="https://t.me/x" /> <use href="#icon" /> <animate to="1" />',
      "location.assign('/today'); navigate(-1)",
    ].join('\n');
    expect(linkLiterals(src)).toEqual([
      '/privacy#cookies', '/reviews', '/more', '/articles/${a.slug}', '/today', '/login?error=1', '/today',
    ]);
  });
});

const REPO = resolve(__dirname, '../..');
const NOT_PRODUCT = /\.test\.tsx?$|\.test-helpers\.ts$|\.d\.ts$|(^|\/)test-support\//;
const listFiles = (dir: string) => readdirSync(join(REPO, dir), { recursive: true }).map(String);

describe('внутренние ссылки webapp/src и shared/src ↔ маршруты App.tsx и public/', () => {
  const app = readFileSync(join(REPO, 'webapp/src/App.tsx'), 'utf8');
  const routes = [...new Set([
    ...routePaths(routeTableBlock(app, 'appRoutes')),
    ...routePaths(routeTableBlock(app, 'personalRoutes')),
  ])];
  const publicFiles = new Set(listFiles('webapp/public'));
  const links = ['webapp/src', 'shared/src'].flatMap((dir) =>
    listFiles(dir)
      .filter((rel) => /\.tsx?$/.test(rel) && !NOT_PRODUCT.test(rel))
      .map((rel) => `${dir}/${rel}`)
      .flatMap((file) => linkLiterals(readFileSync(join(REPO, file), 'utf8')).map((link) => ({ file, link }))),
  );

  it('разбор не ослеп: ссылки нашлись, маршруты обеих таблиц прочитаны', () => {
    expect(links.length).toBeGreaterThan(40);
    expect(routes).toEqual(expect.arrayContaining(['/today', '/reviews', '/cabinet/:clientId/:tab']));
  });

  it('каждая ведёт на маршрут или файл public/', () => {
    const broken = links.filter(({ link }) => !isLinkAlive(link, routes, publicFiles));
    expect(broken.map(({ file, link }) => `${file}: ${link}`)).toEqual([]);
  });
});
