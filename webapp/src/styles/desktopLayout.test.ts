// @vitest-environment node
// Сверка «компьютер не стал телефоном» (инцидент 2026-11-04, docs/INCIDENTS.md): волны «один стиль»
// (#907/#910/#913) вводили примитивы и раскладки, снятые только на 393px, — на ≥768 экраны стали
// телефонными. Телефонное объявление живёт только под @media (max-width: 767px), а у примитива,
// который на телефоне полоса/растяжение, есть правило для ≥768. CSS в jsdom не исполняется — читаем исходники.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Rule = { media: string; selectors: string[]; body: string };

/** Правила со своим медиа-контекстом ('' — вне @media). Один уровень вложенности — как во всех css пакета. */
function parseRules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const walk = (text: string, media: string) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      for (; j < text.length && depth > 0; j++) depth += text[j] === '{' ? 1 : text[j] === '}' ? -1 : 0;
      const inner = text.slice(open + 1, j - 1);
      if (head.startsWith('@media')) walk(inner, head);
      else if (!head.startsWith('@')) out.push({ media, selectors: head.split(',').map((s) => s.trim()), body: inner });
      i = j;
    }
  };
  walk(src, '');
  return out;
}

const isPhone = (m: string) => /max-width:\s*767px/.test(m);
const isDesktop = (m: string) => /min-width:\s*768px/.test(m);

/** Телефонное объявление (свойство/значение) у селектора вне телефонного медиа и вне ≥768 — нарушение. */
function unscopedPhone(rules: Rule[], selector: string, decl: RegExp): string[] {
  return rules
    .filter((r) => r.selectors.includes(selector) && !isPhone(r.media) && !isDesktop(r.media) && decl.test(r.body))
    .map((r) => `${r.media || '(без медиа)'} ${selector} { ${r.body.trim()} }`);
}
const hasDesktopRule = (rules: Rule[], selectorPart: string): boolean =>
  rules.some((r) => isDesktop(r.media) && r.selectors.some((s) => s.includes(selectorPart)));

const dir = __dirname;
const files = readdirSync(dir).filter((f) => f.endsWith('.css'));
const all = files.flatMap((f) => parseRules(readFileSync(join(dir, f), 'utf8')).map((r) => ({ ...r, f })));
const indexRules = parseRules(readFileSync(join(dir, '..', 'index.css'), 'utf8'));

/** Телефонная раскладка примитивов: растяжение на всю колонку — только ≤767 (на компьютере по содержимому). */
const PHONE_ONLY: [string, RegExp][] = [
  ['.ds-btn--lg', /(^|;|\s)width:\s*100%/],
  ['.ds-seg--full', /(^|;|\s)width:\s*100%/],
];
/** Примитивы и раскладки, у которых на ≥768 обязано быть своё правило (вид из макета до волн). */
const NEED_DESKTOP = ['.ds-sheet-head--page', '.ds-seg--full', '.cw-list', '.cw-item', '.sd-explainer-stack', '.cm-page > .ds-card--flush', '.ap-main--state', '.ap-donate-shell'];

describe('компьютер ≥768 не наследует телефонную раскладку', () => {
  it.each(PHONE_ONLY)('%s: width: 100% только под @media (max-width: 767px)', (sel, decl) => {
    expect(unscopedPhone(all, sel, decl)).toEqual([]);
  });
  it.each(NEED_DESKTOP)('%s: есть правило под @media (min-width: 768px)', (sel) => {
    expect(hasDesktopRule(all, sel)).toBe(true);
  });
  it('пункты сайдбара 44 — только под палец: (pointer: coarse), (max-width: 767px)', () => {
    for (const sel of ['.sb-nav > .sb-item', '.sb-links .sb-item', '.sb-legal a']) {
      const bad = indexRules.filter((r) => r.selectors.includes(sel) && !/pointer:\s*coarse/.test(r.media) && /min-height:\s*44px/.test(r.body));
      expect(bad.map((r) => r.selectors.join(','))).toEqual([]);
    }
  });
});

describe('auth-pay.css: страницы подписки и доната на компьютере', () => {
  const ap = parseRules(readFileSync(join(dir, 'auth-pay.css'), 'utf8'));
  const decl = (r: Rule) => r.body.replace(/\s+/g, ' ');
  it('на ≥768 у .ap-main служебных состояний и доната боковой padding 0 (иначе .ds-page съедает колонку)', () => {
    for (const sel of ['.ds-page.ap-main--state', '.ap-page--donate .ds-page.ap-main']) {
      const r = ap.find((x) => isDesktop(x.media) && x.selectors.includes(sel));
      expect(r && /padding-left:\s*0/.test(decl(r)) && /padding-right:\s*0/.test(decl(r))).toBe(true);
    }
  });
  it('.ap-home скрыт вне медиа и показан только внутри ≥768', () => {
    const base = ap.filter((r) => r.selectors.includes('.ap-home'));
    expect(base).toHaveLength(1);
    expect(base[0].media).toBe('');
    expect(base[0].body).toMatch(/display:\s*none/);
    const shown = ap.filter((r) => /display:\s*inline-flex/.test(r.body) && r.selectors.some((s) => s.includes('.ap-home')));
    expect(shown.length).toBeGreaterThan(0);
    for (const r of shown) expect(isDesktop(r.media)).toBe(true);
  });
  it('шапка .ds-sheet-head--page скрыта только внутри ≥768 и только у state/donate', () => {
    const hid = ap.filter((r) => r.selectors.some((s) => s.includes('.ds-sheet-head--page')) && /display:\s*none/.test(r.body));
    expect(hid.length).toBeGreaterThan(0);
    for (const r of hid) {
      expect(isDesktop(r.media)).toBe(true);
      expect(r.selectors.every((s) => /\.ap-page--(state|donate)\b/.test(s))).toBe(true);
    }
  });
  it('client-more.css: правила .cm-page — только через ребёнка (.cm-page > …), листы внутри страницы не затрагиваются', () => {
    const cm = parseRules(readFileSync(join(dir, 'client-more.css'), 'utf8'));
    const leaks = cm.flatMap((r) => r.selectors).filter((s) => /\.cm-page\s+[^>\s]/.test(s));
    expect(leaks).toEqual([]);
  });
});

describe('сверка ловит нарушение и пропускает исправленное', () => {
  it('width: 100% у .ds-btn--lg без медиа — красное; под ≤767 — зелёное', () => {
    expect(unscopedPhone(parseRules('.ds-btn--lg { width: 100%; }'), '.ds-btn--lg', PHONE_ONLY[0][1])).toHaveLength(1);
    expect(unscopedPhone(parseRules('@media (max-width: 767px) { .ds-btn--lg { width: 100%; } }'), '.ds-btn--lg', PHONE_ONLY[0][1])).toEqual([]);
  });
  it('отсутствие правила ≥768 — красное, наличие — зелёное', () => {
    expect(hasDesktopRule(parseRules('.cw-list { display: block; }'), '.cw-list')).toBe(false);
    expect(hasDesktopRule(parseRules('@media (min-width: 768px) { .cw-list { display: flex; } }'), '.cw-list')).toBe(true);
  });
});
