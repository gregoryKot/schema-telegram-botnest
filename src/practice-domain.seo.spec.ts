// robots.txt и sitemap.xml визитки ⇄ её страницы (правило №4). Решение владельца
// 2026-10-24: в поиске главная и /reviews, остальное закрыто. Каждая страница
// визитки (PRACTICE_PAGES — зеркало personalRoutes) классифицирована: новая
// страница без решения роняет тест, а не открывается ботам молча.
import {
  PRACTICE_INDEXED_PAGES,
  practiceRobots,
  practiceSitemap,
} from './practice-domain.seo';
import {
  PRACTICE_PAGES,
  PRACTICE_PAGE_PREFIXES,
} from './practice-domain.surface';
import { readFileSync } from 'fs';
import { join } from 'path';

const robots = practiceRobots('kotlarewski.gr');

// Матчер одной группы «*» по RFC 9309: побеждает самое длинное совпадение, при
// равенстве — Allow; «*» — любая строка, «$» в конце якорит конец пути. Полный
// матчер с группами по ботам — в webapp/src/robotsTxt.test.ts (vitest); общий модуль
// в shared/ не выносим: бэкенд в рантайме shared/ не импортирует, а здесь одна группа
// (ниже проверено, что второй нет).
function isAllowed(text: string, path: string): boolean {
  let best = { allow: true, pattern: '' };
  for (const m of text.matchAll(/^(Allow|Disallow):\s*(\S+)$/gm)) {
    const rule = { allow: m[1] === 'Allow', pattern: m[2] };
    const re = new RegExp(
      '^' +
        rule.pattern.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'),
    );
    if (!re.test(path)) continue;
    const longer = rule.pattern.length > best.pattern.length;
    const tieAllow = rule.pattern.length === best.pattern.length && rule.allow;
    if (longer || tieAllow) best = rule;
  }
  return best.allow;
}

const pages = [
  ...PRACTICE_PAGES,
  ...PRACTICE_PAGE_PREFIXES.map((prefix) => `${prefix}some-slug`),
];

describe('robots.txt визитки ⇄ страницы визитки', () => {
  it('матчер: «/$» открывает только корень, длинное совпадение побеждает', () => {
    const txt = 'Allow: /$\nDisallow: /a\nAllow: /a/b\n';
    expect(isAllowed(txt, '/')).toBe(true);
    expect(isAllowed(txt, '/a')).toBe(false);
    expect(isAllowed(txt, '/a/b')).toBe(true);
    expect(isAllowed(txt, '/zzz')).toBe(true);
  });

  it('одна группа «User-agent: *» — бот со своей группой «*» не читает (#813)', () => {
    expect(robots.match(/^User-agent:.*$/gm)).toEqual(['User-agent: *']);
  });

  it('в поиске ровно главная и /reviews', () => {
    expect(pages.filter((p) => isAllowed(robots, p)).sort()).toEqual(
      [...PRACTICE_INDEXED_PAGES].sort(),
    );
  });

  it('у каждой страницы в поиске свой canonical и заголовок на фронте', () => {
    const chrome = readFileSync(
      join(__dirname, '..', 'webapp/src/utils/domainChrome.ts'),
      'utf8',
    );
    const block = /PRACTICE_INDEXED_TITLES[^{]*\{([\s\S]*?)\n\};/.exec(
      chrome,
    )?.[1];
    if (!block)
      throw new Error(
        'PRACTICE_INDEXED_TITLES не найден в domainChrome.ts — обнови регэксп',
      );
    const keys = [...block.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...PRACTICE_INDEXED_PAGES].sort());
  });

  it('закрыты /subscribe и /donate — копии страниц продукта', () => {
    expect(isAllowed(robots, '/subscribe')).toBe(false);
    expect(isAllowed(robots, '/donate')).toBe(false);
  });

  it('ссылки клиентов закрыты вместе с параметрами', () => {
    for (const p of ['/book', '/booking/paid?t=x', '/booking/manage?t=x']) {
      expect(isAllowed(robots, p)).toBe(false);
    }
  });

  it('sitemap.xml визитки — те же страницы, что открыты в robots.txt', () => {
    const xml = practiceSitemap('kotlarewski.gr');
    const locs = [
      ...xml.matchAll(/<loc>https:\/\/kotlarewski\.gr([^<]*)<\/loc>/g),
    ].map((m) => m[1]);
    expect(locs).toEqual([...PRACTICE_INDEXED_PAGES]);
    expect(locs.every((p) => isAllowed(robots, p))).toBe(true);
    expect(robots).toContain('Sitemap: https://kotlarewski.gr/sitemap.xml');
  });
});
