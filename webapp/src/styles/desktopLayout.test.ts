// @vitest-environment node
// Сверка «компьютер не стал телефоном» (инцидент 2026-11-04, docs/INCIDENTS.md): волны «один стиль»
// (#907/#910/#913) вводили раскладки, снятые только на 393px, — на ≥768 экраны стали телефонными.
// Телефонное объявление живёт только под точным @media (max-width: 767px) (блок касаний ≥768 не в счёте),
// у примитива-полосы/растяжения есть правило для ≥768. CSS в jsdom не исполняется — читаем исходники.
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseRules, isPhone, isTouch, isDesktop, unscopedPhone, hasDesktopRule, allCssRules, readCss, indexCssRules, tsxUsing, cssDir, type Rule } from './cssRules.test-helpers';

const all = allCssRules();
const WIDE = /(^|;|\s)width:\s*100%/;
/** Телефонная раскладка примитивов: растяжение на колонку — только ≤767 (на компьютере по содержимому). */
const PHONE_ONLY: [string, RegExp][] = [['.ds-btn--lg', WIDE], ['.ds-seg--full', WIDE]];
/** Примитивы и раскладки, у которых на ≥768 обязано быть своё правило; ':файл' — искать только в нём, по точному селектору. */
const NEED_DESKTOP = ['.ds-sheet-head--page:cabinet.css', '.ds-seg--full:cabinet.css', '.cw-list', '.cw-item', '.sd-explainer-stack', '.cm-page > .ds-card--flush', '.ap-main--state', '.ap-donate-shell'];
/** Скрытие телефонных элементов: display: none только под точным ≤767. */
const PHONE_HIDDEN: [string, string][] = [['therapist-concept.css', '.tcp-head-title'], ['therapist-concept.css', '.tcp-more-txt']];

/** Каждый потребитель ds-btn--lg решает ширину на ≥768: own — своё width: 100%, stretch — колонка растягивает, content — по содержимому. */
const LG: Record<string, ['own' | 'stretch' | 'content', string]> = {
  'components/WhySheet.tsx': ['own', '.cw-inner .ds-btn--lg'],
  'components/settingsSheet/AboutSheet.tsx': ['own', '.st-done'],
  'components/therapy/TalkSheet.tsx': ['stretch', '.th-sheet-acts'],
  'sections/schemas/MineGroupsList.tsx': ['stretch', '.cs-block'],
  'sections/diary/DiaryHeader.tsx': ['content', '.cd-write'],
  'pages/subscribe/SubscribeForm.tsx': ['own', '.ap-pay .ds-btn--lg'],
  'pages/DonatePage.tsx': ['own', '.ap-donate .ds-btn--lg'],
  'pages/SubscribePage.tsx': ['own', '.ap-main--state .ds-btn--lg'],
};
function lgDecisionOk(rules: Rule[], kind: 'own' | 'stretch' | 'content', sel: string): boolean {
  const mine = rules.filter((r) => r.selectors.includes(sel) && !isPhone(r.media) && !isTouch(r.media));
  if (kind === 'own') return mine.some((r) => WIDE.test(r.body));
  if (kind === 'content') return mine.some((r) => isDesktop(r.media) && /width:\s*auto/.test(r.body));
  return mine.some((r) => /flex-direction:\s*column/.test(r.body) && !/align-items:\s*(flex-start|center|flex-end)/.test(r.body));
}

describe('компьютер ≥768 не наследует телефонную раскладку', () => {
  it.each(PHONE_ONLY)('%s: width: 100% только под @media (max-width: 767px), не в блоке касаний', (sel, decl) => {
    expect(unscopedPhone(all, sel, decl)).toEqual([]);
  });
  it.each(NEED_DESKTOP)('%s: есть правило под @media (min-width: 768px)', (spec) => {
    const [sel, file] = spec.split(':');
    expect(hasDesktopRule(file ? readCss(file) : all, sel, !!file)).toBe(true);
  });
  it.each(PHONE_HIDDEN)('%s: %s скрыт только под точным ≤767', (file, sel) => {
    const hid = readCss(file).filter((r) => r.selectors.includes(sel) && /display:\s*none/.test(r.body));
    expect(hid.length).toBeGreaterThan(0);
    expect(hid.filter((r) => !isPhone(r.media))).toEqual([]);
  });
  it('пункты сайдбара 44 — только под палец; на мыши не меньше 24 (WCAG 2.5.8)', () => {
    const idx = indexCssRules();
    for (const sel of ['.sb-nav > .sb-item', '.sb-links .sb-item', '.sb-legal a']) {
      expect(idx.filter((r) => r.selectors.includes(sel) && !isTouch(r.media) && /min-height:\s*44px/.test(r.body))).toEqual([]);
    }
    for (const sel of ['.sb-links .sb-item', '.sb-legal a']) {
      const base = idx.find((r) => r.selectors.includes(sel) && r.media === '' && /min-height:\s*(\d+)px/.test(r.body));
      expect(Number(base?.body.match(/min-height:\s*(\d+)px/)?.[1] ?? 0)).toBeGreaterThanOrEqual(24);
    }
  });
  it('у каждого потребителя ds-btn--lg решена ширина на компьютере (список LG)', () => {
    const used = [...tsxUsing(join(cssDir, '..'), 'ds-btn--lg'), ...tsxUsing(join(cssDir, '../../../shared/src'), 'ds-btn--lg')].sort();
    expect(used).toEqual(Object.keys(LG).sort());
    for (const [file, [kind, sel]] of Object.entries(LG)) expect([file, lgDecisionOk(all, kind, sel)]).toEqual([file, true]);
  });
});

describe('auth-pay.css: страницы подписки и доната на компьютере', () => {
  const ap = readCss('auth-pay.css');
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
  it('.ap-donate-shell: вне медиа ровно display: contents, display: flex — только в ≥768 (телефон: обёртки нет)', () => {
    const rs = ap.filter((r) => r.selectors.includes('.ap-donate-shell'));
    const base = rs.filter((r) => r.media === '');
    expect(base).toHaveLength(1);
    expect(base[0].body).toMatch(/display:\s*contents/);
    for (const r of rs.filter((x) => /display:\s*(flex|block|grid)/.test(x.body))) expect(isDesktop(r.media)).toBe(true);
  });
  it('шапка .ds-sheet-head--page скрыта только внутри ≥768 и только у state/donate/form', () => {
    const hid = ap.filter((r) => r.selectors.some((s) => s.includes('.ds-sheet-head--page')) && /display:\s*none/.test(r.body));
    expect(hid.length).toBeGreaterThan(0);
    for (const r of hid) {
      expect(isDesktop(r.media)).toBe(true);
      expect(r.selectors.every((s) => /\.ap-page--(state|donate|form)\b/.test(s))).toBe(true);
    }
  });
  it('client-more.css: правила .cm-page — только через ребёнка (.cm-page > …), листы внутри страницы не затрагиваются', () => {
    const leaks = readCss('client-more.css').flatMap((r) => r.selectors).filter((s) => /\.cm-page\s+[^>\s]/.test(s));
    expect(leaks).toEqual([]);
  });
});

describe('сверка ловит нарушение и пропускает исправленное', () => {
  const lg = (css: string) => unscopedPhone(parseRules(css), '.ds-btn--lg', WIDE);
  it('width: 100% у .ds-btn--lg: без медиа и в блоке касаний — красное; под точным ≤767 — зелёное', () => {
    expect(lg('.ds-btn--lg { width: 100%; }')).toHaveLength(1);
    expect(lg('@media (pointer: coarse), (max-width: 767px) { .ds-btn--lg { width: 100%; } }')).toHaveLength(1);
    expect(lg('@media (max-width:767px) { .ds-btn--lg { width: 100%; } }')).toEqual([]);
  });
  it('отсутствие правила ≥768 — красное, наличие — зелёное; exact не принимает селектор с предком', () => {
    expect(hasDesktopRule(parseRules('.cw-list { display: block; }'), '.cw-list')).toBe(false);
    expect(hasDesktopRule(parseRules('@media (min-width: 768px) { .cw-list { display: flex; } }'), '.cw-list')).toBe(true);
    const scoped = parseRules('@media (min-width: 768px) { .ap-page--state .ds-sheet-head--page { display: none; } }');
    expect(hasDesktopRule(scoped, '.ds-sheet-head--page')).toBe(true);
    expect(hasDesktopRule(scoped, '.ds-sheet-head--page', true)).toBe(false);
  });
  it('решение по ширине кнопки: нет width — красное; есть — зелёное; растяжение колонкой и «по содержимому»', () => {
    expect(lgDecisionOk(parseRules('.st-done { margin-top: 20px; }'), 'own', '.st-done')).toBe(false);
    expect(lgDecisionOk(parseRules('.st-done { width: 100%; }'), 'own', '.st-done')).toBe(true);
    expect(lgDecisionOk(parseRules('@media (max-width: 767px) { .st-done { width: 100%; } }'), 'own', '.st-done')).toBe(false);
    expect(lgDecisionOk(parseRules('.a { display: flex; flex-direction: column; align-items: center; }'), 'stretch', '.a')).toBe(false);
    expect(lgDecisionOk(parseRules('.a { display: flex; flex-direction: column; }'), 'stretch', '.a')).toBe(true);
    expect(lgDecisionOk(parseRules('@media (min-width: 768px) { .b { width: auto; } }'), 'content', '.b')).toBe(true);
  });
  it('display: none вне точного ≤767 (в т.ч. в блоке касаний) — красное', () => {
    const bad = (css: string) => parseRules(css).filter((r) => r.selectors.includes('.x') && /display:\s*none/.test(r.body) && !isPhone(r.media));
    expect(bad('.x { display: none; }')).toHaveLength(1);
    expect(bad('@media (pointer: coarse), (max-width: 767px) { .x { display: none; } }')).toHaveLength(1);
    expect(bad('@media (max-width: 767px) { .x { display: none; } }')).toEqual([]);
  });
});
