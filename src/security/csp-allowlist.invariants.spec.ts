// Аудит 2026-10-11 («Мелочь»): script-src разрешал https://telegram.org, хотя
// ни одна страница скриптов оттуда не грузит — telegram-web-app.js отдаём
// сами (входа через Telegram на сайте нет с 2026-11). Мёртвая
// запись allowlist — лишняя дверь: чужой скрипт с этого домена исполнился бы.
//
// Сверка от настоящего заголовка (helmet с helmetOptions, через HTTP): у
// каждого внешнего источника script-src, connect-src и img-src есть
// потребитель среди того, что исполняется у пользователя. img-src взят в
// сверку в 2026-11, когда из него ушла мёртвая https://cdn.jsdelivr.net
// (обложка визитки шла оттуда до 2026-10; ни фронт, ни сид статей её не
// упоминают).
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { helmetOptions } from './helmet-config';
import {
  frontendSources,
  type SourceText,
} from '../test-support/frontend-sources';

const CHECKED = ['script-src', 'connect-src', 'img-src'];

async function directives(): Promise<Map<string, string[]>> {
  const app = express();
  app.use(helmet(helmetOptions()));
  app.get('/', (_req, res) => {
    res.send('ok');
  });
  const res = await request(app).get('/').expect(200);
  const out = new Map<string, string[]>();
  for (const d of String(res.headers['content-security-policy']).split(';')) {
    const [name, ...values] = d.trim().split(/\s+/);
    if (name) out.set(name, values);
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Хост упомянут целиком, а не подстрокой (правило №14): `telegram.org` не
 * находится внутри `oauth.telegram.org` и `telegram.org.evil`.
 */
function mentions(text: string, host: string): boolean {
  return new RegExp(`(?<![\\w.-])${escape(host)}(?![\\w-]|\\.\\w)`).test(text);
}

/** Внешние источники без единого потребителя. */
function orphanOrigins(origins: string[], sources: SourceText[]): string[] {
  return origins
    .filter((o) => o.startsWith('https://'))
    .filter((o) => {
      const host = o.slice('https://'.length);
      return !sources.some((s) => mentions(s.text, host));
    });
}

describe('CSP: у каждого внешнего источника есть потребитель', () => {
  const sources = frontendSources();

  it.each(CHECKED)('%s: ни одной мёртвой записи', async (name) => {
    const got = (await directives()).get(name);
    expect(got).toBeDefined();
    expect(got).toContain("'self'");
    expect(orphanOrigins(got!, sources)).toEqual([]);
  });

  it('script-src не пускает telegram.org: SDK мини-приложения свой', async () => {
    const got = (await directives()).get('script-src');
    expect(got).not.toContain('https://telegram.org');
    // А потребители соседних записей по-прежнему видны сверке.
    expect(orphanOrigins(['https://mc.yandex.ru'], sources)).toEqual([]);
  });

  // Запрос РКН №08-1063539 (2026-11): авторизация через иностранный сервис
  // убрана, страница входа не должна обращаться к Google — ни скрипт, ни
  // запрос, ни iframe оттуда CSP не пропускает.
  it('ни одна директива CSP не пускает хосты Google', async () => {
    const all = [...(await directives()).values()].flat();
    expect(all.filter((v) => /google|gstatic/i.test(v))).toEqual([]);
  });

  // Тот же запрос: вход через Telegram на сайте убран. Ни скрипт, ни запрос, ни
  // iframe с telegram.org / oauth.telegram.org CSP не пропускает. Единственное
  // место, где хост Telegram законен, — frame-ancestors: это право Telegram Web
  // встроить мини-приложение, а не право страницы обратиться к Telegram.
  it('хосты Telegram есть только в frame-ancestors; чужих фреймов нет', async () => {
    const all = await directives();
    const outside = [...all.entries()]
      .filter(([name]) => name !== 'frame-ancestors')
      .flatMap(([, values]) => values);
    expect(outside.filter((v) => /telegram/i.test(v))).toEqual([]);
    expect(all.get('frame-src')).toEqual(["'none'"]);
    // Контроль: проверка не слепа — в frame-ancestors Telegram Web есть.
    expect(all.get('frame-ancestors')!.some((v) => /telegram/i.test(v))).toBe(
      true,
    );
  });

  it('контроль: источник без потребителя краснеет, подстрока не спасает', () => {
    const fixture: SourceText[] = [
      {
        path: 'a.ts',
        text: "location.href = 'https://oauth.telegram.org/auth'",
      },
    ];
    expect(
      orphanOrigins(['https://evil.example', 'https://telegram.org'], fixture),
    ).toEqual(['https://evil.example', 'https://telegram.org']);
    expect(orphanOrigins(['https://oauth.telegram.org'], fixture)).toEqual([]);
    expect(
      orphanOrigins(
        ['https://telegram.org'],
        [
          {
            path: 'b.html',
            text: '<script src="https://telegram.org/js/x.js">',
          },
        ],
      ),
    ).toEqual([]);
    expect(mentions('telegram.org.evil', 'telegram.org')).toBe(false);
  });
});
