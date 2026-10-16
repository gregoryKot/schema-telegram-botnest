// Сверка deploy/vps/Caddyfile с кодом, который решает судьбу хоста (правило
// №4: два места, обязанные совпадать, фиксируются тестом). Caddy выпускает
// сертификат и пускает на приложение только хосты из своего списка; хост,
// которого там нет, до приложения не доходит вовсе, а значит не получит от него
// и редирект (инцидент 2026-09-16: хосты и редиректы между ними — источник петли).
// Список хостов — единственный, в заголовке сайт-блока Caddyfile.
import { readFileSync } from 'fs';
import { join } from 'path';
import { CANONICAL_HOST, isRedirectedHost } from './canonical-host';
import { TRUSTED_PROXY_HOPS } from './trust-proxy';
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

// Число хопов `trust proxy` и Caddyfile обязаны совпадать (правило №4).
// Caddy без `trusted_proxies` отдаёт приложению ровно один хоп: сам Caddy.
// `trusted_proxies` значит, что перед Caddy стоит ещё один прокси (CDN) и
// приложению нужно доверять двум хопам, иначе все IP-бакеты (правило №5)
// схлопнутся в адрес CDN.
function expectedHops(caddyText: string): number {
  const code = caddyText
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');
  return 1 + (/\btrusted_proxies\b/.test(code) ? 1 : 0);
}

/** Порты, опубликованные наружу сервисом compose (`ports:`), а не `expose:`. */
function publishedPorts(composeText: string, service: string): string[] {
  const lines = composeText.split('\n');
  const start = lines.findIndex((l) => l === `  ${service}:`);
  if (start < 0) throw new Error(`сервис ${service} не найден`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^ {2}\S/.test(l));
  const body = (end < 0 ? rest : rest.slice(0, end)).filter(
    (l) => !l.trim().startsWith('#'),
  );
  const at = body.findIndex((l) => /^ {4}ports:/.test(l));
  if (at < 0) return [];
  const items: string[] = [];
  for (const l of body.slice(at + 1)) {
    const m = /^ {6}- (.+)$/.exec(l);
    if (!m) break;
    items.push(m[1]);
  }
  return items.length ? items : ['(inline)'];
}

describe('доверие к прокси: Caddyfile ↔ trust proxy', () => {
  const compose = readFileSync(
    join(process.cwd(), 'deploy', 'vps', 'docker-compose.yml'),
    'utf8',
  );
  const mainTs = readFileSync(join(process.cwd(), 'src', 'main.ts'), 'utf8');

  it('число хопов в коде = число хопов по Caddyfile', () => {
    expect(TRUSTED_PROXY_HOPS).toBe(expectedHops(caddyfile));
  });

  it('контроль: trusted_proxies в Caddyfile требует двух хопов, а комментарий не считается', () => {
    const withCdn = `${caddyfile}\n{\n\tservers {\n\t\ttrusted_proxies static private_ranges\n\t}\n}\n`;
    expect(expectedHops(withCdn)).toBe(2);
    expect(expectedHops(withCdn)).not.toBe(TRUSTED_PROXY_HOPS);
    expect(expectedHops('# trusted_proxies тут только в комментарии\n')).toBe(
      1,
    );
  });

  it('app наружу не опубликован: только expose, без ports', () => {
    expect(publishedPorts(compose, 'app')).toEqual([]);
    expect(publishedPorts(compose, 'caddy')).toContain("'443:443'");
  });

  it('контроль: опубликованный порт app обнаруживается', () => {
    const leaky = compose.replace(
      "    expose:\n      - '3000'",
      "    ports:\n      - '3000:3000'",
    );
    expect(leaky).not.toBe(compose);
    expect(publishedPorts(leaky, 'app')).toEqual(["'3000:3000'"]);
  });

  it('main.ts берёт хопы из константы, литерала нет', () => {
    expect(mainTs).toContain("app.set('trust proxy', TRUSTED_PROXY_HOPS)");
    expect(mainTs).not.toMatch(/set\(\s*'trust proxy',\s*(true|\d)/);
  });
});
