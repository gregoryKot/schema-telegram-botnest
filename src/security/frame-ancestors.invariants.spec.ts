// Аудит 2026-10-11 (security#8): CSP frame-ancestors не пускал Telegram Web,
// хотя код выдавал для него кросс-сайтовую куку. Мини-апп в web.telegram.org
// не рисовался («Refused to frame»), сервер отвечал 200, сигнала не было.
// Тест на шве: заголовок собирает настоящий helmet с настоящим конфигом
// (helmetOptions — ровно то, что main.ts передаёт в app.use), запрос идёт
// через HTTP, а не регэкспом по исходнику.
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { EMBEDDERS, frameAncestors } from './embedders';
import { helmetOptions } from './helmet-config';

function buildApp() {
  const app = express();
  app.use(helmet(helmetOptions()));
  app.get('/app/', (_req, res) => {
    res.send('ok');
  });
  return app;
}

async function ancestors(): Promise<string[]> {
  const res = await request(buildApp()).get('/app/').expect(200);
  const csp = String(res.headers['content-security-policy']);
  const directive = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('frame-ancestors '));
  expect(directive).toBeDefined();
  return directive!.split(/\s+/).slice(1);
}

describe('CSP frame-ancestors: единый реестр встраивателей', () => {
  it('в заголовке есть каждый origin реестра и сам сайт', async () => {
    const got = await ancestors();
    expect(got).toContain("'self'");
    for (const e of EMBEDDERS) {
      for (const origin of e.origins) expect(got).toContain(origin);
    }
  });

  it('Telegram Web (web., webk., weba.) пущен в iframe', async () => {
    const got = await ancestors();
    expect(got).toContain('https://web.telegram.org');
    expect(got).toContain('https://webk.telegram.org');
    expect(got).toContain('https://weba.telegram.org');
    // webz. отвечает 301 на weba. и родителем iframe не бывает.
    expect(got).not.toContain('https://webz.telegram.org');
  });

  it('заголовок состоит только из реестра: ничего лишнего и без «всем можно»', async () => {
    const got = await ancestors();
    expect(got).toEqual(frameAncestors());
    expect(got).not.toContain('*');
    expect(got).not.toContain('https:');
    // Контроль узости: ни целый .telegram.org, ни чужой хост не пущены.
    expect(got).not.toContain('https://*.telegram.org');
    expect(got).not.toContain('https://evil.example');
  });

  it('X-Frame-Options не вешается и не перебивает CSP', async () => {
    const res = await request(buildApp()).get('/app/');
    expect(res.headers['x-frame-options']).toBeUndefined();
  });

  it('каждый встраиватель назван, с origin только https и без путей', () => {
    const names = EMBEDDERS.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    for (const e of EMBEDDERS) {
      expect(e.origins.length).toBeGreaterThan(0);
      for (const o of e.origins) {
        expect(o).toMatch(/^https:\/\/[^/\s]+$/);
        // Не «https://*»: хост — настоящее имя, допустима только подстановка
        // одного уровня поддомена в начале.
        expect(o).toMatch(
          /^https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]+$/,
        );
      }
    }
  });
});
