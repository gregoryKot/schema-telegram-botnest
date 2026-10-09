// Сверка deploy/vps/Caddyfile с кодом, который решает судьбу хоста (правило
// №4: два места, обязанные совпадать, фиксируются тестом). Caddy выпускает
// сертификат и пускает на приложение только хосты из своего списка; хост,
// которого там нет, до приложения не доходит вовсе, а значит не получит от него
// и редирект (инцидент 2026-09-16: хосты и редиректы между ними — источник петли).
// Список хостов — единственный, в заголовке сайт-блока Caddyfile.
import { readFileSync } from 'fs';
import { join } from 'path';
import { CANONICAL_HOST, isRedirectedHost } from './canonical-host';
import {
  PRACTICE_ALIAS_HOSTS,
  practiceDomainMiddleware,
} from '../practice-domain.middleware';

const caddyfile = readFileSync(
  join(process.cwd(), 'deploy', 'vps', 'Caddyfile'),
  'utf8',
);

/** Хосты из заголовка сайт-блока: всё до первой `{`, без комментариев. */
function caddyHosts(text: string): string[] {
  const header = text
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n')
    .split('{')[0];
  return header
    .split(/[,\s]+/)
    .map((h) => h.trim())
    .filter(Boolean);
}

/** Куда практика-мидлвар редиректит запрос на этот хост (или null — не редиректит). */
function practiceRedirect(host: string): string | null {
  let target: string | null = null;
  practiceDomainMiddleware(
    { hostname: host, path: '/', originalUrl: '/', method: 'GET' } as never,
    { redirect: (_c: number, url: string) => (target = url) } as never,
    () => undefined,
  );
  return target;
}

describe('deploy/vps/Caddyfile ↔ хосты приложения', () => {
  const hosts = caddyHosts(caddyfile);

  it('список разобран и без дублей', () => {
    expect(hosts.length).toBeGreaterThan(0);
    expect(new Set(hosts).size).toBe(hosts.length);
  });

  it('канонический хост, www и алиасы визитки обслуживаются', () => {
    expect(hosts).toContain(CANONICAL_HOST);
    expect(hosts).toContain(`www.${CANONICAL_HOST}`);
    for (const alias of PRACTICE_ALIAS_HOSTS) expect(hosts).toContain(alias);
  });

  it('каждый хост из Caddyfile известен коду: канонический, 301-редиректимый или алиас визитки', () => {
    for (const host of hosts) {
      const known =
        host === CANONICAL_HOST ||
        isRedirectedHost(host) ||
        PRACTICE_ALIAS_HOSTS.has(host) ||
        practiceRedirect(host) !== null;
      expect({ host, known }).toEqual({ host, known: true });
    }
  });

  it('хосты, которые код редиректит, в Caddyfile есть (иначе редирект никто не отдаст)', () => {
    // Хосты из исходников: «знает код» читается из самих файлов, потому что
    // списки legacy- и redirect-хостов внутри модулей не экспортируются.
    const sources = ['infra/canonical-host.ts', 'practice-domain.middleware.ts']
      .map((f) => readFileSync(join(process.cwd(), 'src', f), 'utf8'))
      .join('\n');
    const mentioned = new Set(
      [
        ...sources.matchAll(
          /'((?:www\.)?(?:schemalab|kotlarewski)\.(?:ru|gr))'/g,
        ),
      ].map((m) => m[1]),
    );
    expect(mentioned.size).toBeGreaterThan(0);
    for (const host of mentioned) expect(hosts).toContain(host);
  });

  it('контроль: чужой хост тест отвергает', () => {
    const stranger = 'example.org';
    const known =
      stranger === CANONICAL_HOST ||
      isRedirectedHost(stranger) ||
      PRACTICE_ALIAS_HOSTS.has(stranger) ||
      practiceRedirect(stranger) !== null;
    expect(known).toBe(false);
  });
});
