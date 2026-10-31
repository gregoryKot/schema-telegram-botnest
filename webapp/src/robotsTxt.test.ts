// robots.txt сайта schemehappens.ru против роутов webapp/src/App.tsx (правило №4).
//
// Находка аудита 2026-10-11: #641 завёл именованные группы для поисковых ботов
// нейросетей и YandexBot с одним «Allow: /». По RFC 9309 §2.2.1 бот, нашедший
// группу со своим именем, группу «*» не читает вовсе — список «Закрываем личный
// кабинет» на YandexBot, GPTBot, ClaudeBot и соседей не действовал, а /admin,
// /link и /app/ не были закрыты даже для «*».
//
// Шов: тест читает тот самый файл, который отдаёт ServeStatic (Vite копирует
// public/ без изменений), и настоящий App.tsx, а не копию списка роутов.
// Матчер — по RFC 9309: группы, фолбэк на «*», побеждает самое длинное
// совпадение, при равенстве — Allow; «*» и «$» в шаблоне.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');

type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[] };

function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value);
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      if (value) current.rules.push({ allow: key === 'allow', pattern: value });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  return groups;
}

const patternRe = (p: string) =>
  new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\?\$$/, '$'));

function isAllowed(text: string, agent: string, path: string): boolean {
  const groups = parseRobots(text);
  const own = groups.filter((g) => g.agents.some((a) => a.toLowerCase() === agent.toLowerCase()));
  const rules = (own.length ? own : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules);
  let best: Rule | null = null;
  for (const r of rules) {
    if (!patternRe(r.pattern).test(path)) continue;
    const longer = !best || r.pattern.length > best.pattern.length;
    const tieAllow = best && r.pattern.length === best.pattern.length && r.allow;
    if (longer || tieAllow) best = r;
  }
  return best ? best.allow : true;
}

function appRoutes(): { open: string[]; authed: string[] } {
  const app = read('App.tsx');
  const block = /const appRoutes = \[([\s\S]*?)\n\];/.exec(app)?.[1];
  if (!block) throw new Error('В App.tsx не найден блок `const appRoutes = [ … ];` — обнови регэксп теста');
  const cut = block.indexOf('element: <RequireAuth />');
  if (cut < 0) throw new Error('В appRoutes не найден маркер `element: <RequireAuth />` — обнови тест');
  const paths = (s: string) =>
    [...s.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]).filter((p) => p !== '*').map((p) => p.replace(/:[^/]+/g, 'x'));
  return { open: paths(block.slice(0, cut)), authed: paths(block.slice(cut)) };
}

// Роуты вне RequireAuth, которые обязаны индексироваться. Остальные вне
// RequireAuth закрываются явно — новый роут без классификации роняет тест.
const PUBLIC = ['/', '/articles', '/articles/x', '/tests', '/tests/x', '/subscribe', '/donate', '/privacy', '/offer', '/login'];
const CLOSED = ['/admin', '/booking-admin', '/articles-admin', '/link'];
const CLOSED_PREFIXES = ['/auth/'];
// Не роуты SPA: оболочка мини-аппа (в том числе ссылка запуска с query) и
// диагностика.
const CLOSED_EXTRA = ['/app', '/app/', '/app?startapp=x', '/app/today', '/app/assets/index.js', '/max-probe.html'];
// Контроль: префиксы закрытого не задевают соседей.
const PUBLIC_EXTRA = ['/apple-touch-icon.png', '/llms.txt', '/sitemap.xml'];
// API, из которого публичные страницы рисуют контент. Googlebot и YandexBot
// рендерят SPA и соблюдают robots.txt для fetch: закрытый /api/ отдал бы
// индексу «Не удалось загрузить статью» и пустой список мини-тестов (ревью
// этой починки). Новая публичная страница с данными — её ручка сюда.
const PUBLIC_API = ['/api/articles', '/api/articles/x', '/api/quizzes', '/api/quizzes?form=vy', '/api/subscription/options'];

const robots = read('../public/robots.txt');
const agents = [...new Set(parseRobots(robots).flatMap((g) => g.agents))];
const crawlers = [...agents.filter((a) => a !== '*'), 'Googlebot', 'SomeUnknownBot'];

describe('матчер robots.txt (самопроверка)', () => {
  it('бот с собственной группой не читает «*» — ровно баг #641', () => {
    const txt = 'User-agent: *\nDisallow: /today\n\nUser-agent: GPTBot\nAllow: /\n';
    expect(isAllowed(txt, 'GPTBot', '/today')).toBe(true);
    expect(isAllowed(txt, 'Googlebot', '/today')).toBe(false);
  });
  it('длинное совпадение побеждает, «$» якорит конец', () => {
    const txt = 'User-agent: *\nAllow: /\nDisallow: /app$\nDisallow: /app/\n';
    expect(isAllowed(txt, 'x', '/app')).toBe(false);
    expect(isAllowed(txt, 'x', '/app/x')).toBe(false);
    expect(isAllowed(txt, 'x', '/apple-touch-icon.png')).toBe(true);
  });
});

describe('robots.txt ↔ роуты App.tsx', () => {
  const { open, authed } = appRoutes();
  const isClosed = (p: string) => CLOSED.includes(p) || CLOSED_PREFIXES.some((pre) => p.startsWith(pre));

  it('каждый роут вне RequireAuth классифицирован, списки не протухли', () => {
    expect(open.filter((p) => !PUBLIC.includes(p) && !isClosed(p))).toEqual([]);
    expect([...PUBLIC, ...CLOSED].filter((p) => !open.includes(p))).toEqual([]);
    for (const pre of CLOSED_PREFIXES) expect(open.some((p) => p.startsWith(pre))).toBe(true);
    expect(authed.length).toBeGreaterThan(5);
  });

  it.each(crawlers)('%s: кабинет, вход, админка и /app/ закрыты', (bot) => {
    const closed = [...authed, ...open.filter(isClosed), ...CLOSED_EXTRA];
    expect(closed.filter((p) => isAllowed(robots, bot, p))).toEqual([]);
  });

  it.each(crawlers)('%s: публичные страницы открыты (контроль против «Disallow: /»)', (bot) => {
    expect([...PUBLIC, ...PUBLIC_EXTRA].filter((p) => !isAllowed(robots, bot, p))).toEqual([]);
  });

  it.each(crawlers)('%s: API публичных страниц открыт — иначе рендер статей пустой', (bot) => {
    expect(PUBLIC_API.filter((p) => !isAllowed(robots, bot, p))).toEqual([]);
  });
});
