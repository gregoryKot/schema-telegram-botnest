// @vitest-environment node
// Сверка «компьютер не стал телефоном» (инцидент 2026-11-04, docs/INCIDENTS.md): волны «один стиль»
// (#907/#910/#913) вводили раскладки, снятые только на 393px, — на ≥768 экраны стали телефонными.
// Телефонное объявление живёт только под точным @media PHONE_MEDIA (utils/phoneLayout.ts; блок касаний ≥768 не в счёте),
// у примитива-полосы/растяжения есть правило для ≥768. CSS в jsdom не исполняется — читаем исходники.
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseRules, isPhone, isTouch, isDesktop, unscopedPhone, hasDesktopRule, phoneBaseDesk, allCssRules, readCss, indexCssRules, tsxUsing, cssDir, type Rule } from './cssRules.test-helpers';
import { PHONE_MEDIA } from '../utils/phoneLayout';

const all = allCssRules();
const PHONE = `@media ${PHONE_MEDIA}`;
const WIDE = /(^|;|\s)width:\s*100%/;
/** Телефонная раскладка примитивов: растяжение на колонку — только ≤767 (на компьютере по содержимому). */
const PHONE_ONLY: [string, RegExp][] = [['.ds-btn--lg', WIDE], ['.ds-seg--full', WIDE]];
/** Примитивы и раскладки, у которых на ≥768 обязано быть своё правило; ':файл' — искать только в нём, по точному селектору. */
const NEED_DESKTOP = ['.ds-sheet-head--page:cabinet.css', '.ds-seg--full:cabinet.css', '.cw-thing', '.cm-page > .ds-card--flush', '.ap-main--state'];
/** Скрытие телефонных элементов: display: none только под точным ≤767. */
const PHONE_HIDDEN: [string, string][] = [['concept-graph.css', '.tcp-head-title'], ['concept-graph.css', '.tcp-more-txt']];
/** Обёртки и правила компьютера, при которых телефон обязан остаться как в main: [селектор, вне медиа, только под ≥768]. */
const C = /display:\s*contents/;
const PHONE_SAME: [string, RegExp | null, RegExp | null][] = [
  ['.cp-open-card', C, null], ['.cp-open-card > .ds-card', null, /background:\s*none/], // дыхание: обёртка не в flex-gap
  ['.tcp-head-actions', C, /display:\s*inline-flex/], ['.tb-tab-title .ds-sub', null, /margin/],
  ['.ap-home', /display:\s*none/, /display:\s*inline-flex/], ['.ap-donate-shell', C, /display:\s*flex/],
];

/** Каждый потребитель ds-btn--lg решает ширину на ≥768: own — своё width: 100%, stretch — колонка растягивает, content — по содержимому. */
const LG: Record<string, ['own' | 'stretch' | 'content', string]> = {
  'components/WhySheet.tsx': ['own', '.cw-inner .ds-btn--lg'],
  'components/booking/ClientBookingSheet.tsx': ['own', '.cbk-actions .ds-btn'], // колонка листа до 560 (client-booking.css)
  'components/settingsSheet/AboutSheet.tsx': ['own', '.st-done'],
  'components/paper/DoneSheet.tsx': ['own', '.ds-btn.pa-done-primary'], // во весь лист «готово» 480–540
  'components/paper/PaperOutcome.tsx': ['own', '.ds-btn.pa-outcome-action'], // во всю карточку исхода 440
  'components/ErrorBoundary.tsx': ['own', '.ds-btn.pa-outcome-action'], // своя кнопка в листе исхода (под ней «Детали»)
  'components/AuthGateViews.tsx': ['own', '.ds-btn.pa-outcome-action'], // занятая «Проверяем…» в листе исхода
  'components/therapy/TalkSheet.tsx': ['stretch', '.th-sheet-acts'],
  'sections/schemas/MineGroupsList.tsx': ['stretch', '.cs-block'],
  'sections/today/TrackerBlock.tsx': ['stretch', '.pp-block'], // блок трекера — колонка pp-block во всю ширину колонки
  'pages/subscribe/SubscribeForm.tsx': ['own', '.ap-pay .ds-btn--lg'],
  'pages/DonatePage.tsx': ['own', '.ap-donate .ds-btn--lg'], // во всю карточку 560
  'pages/SubscribePage.tsx': ['own', '.ap-main--state .ds-btn--lg'], // во всю колонку 400
};
function lgDecisionOk(rules: Rule[], kind: 'own' | 'stretch' | 'content', sel: string): boolean {
  const mine = rules.filter((r) => r.selectors.includes(sel) && !isPhone(r.media) && !isTouch(r.media));
  if (kind === 'own') return mine.some((r) => WIDE.test(r.body));
  if (kind === 'content') return mine.some((r) => isDesktop(r.media) && /width:\s*auto/.test(r.body));
  return mine.some((r) => /flex-direction:\s*column/.test(r.body) && !/align-items:\s*(flex-start|center|flex-end)/.test(r.body));
}

describe('компьютер ≥768 не наследует телефонную раскладку', () => {
  it.each(PHONE_ONLY)('%s: width: 100% только под телефонным @media, не в блоке касаний', (sel, decl) => {
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
  it.each(PHONE_SAME)('%s: телефон как в main, компьютерное — только под ≥768', (sel, base, desk) => {
    expect(phoneBaseDesk(all, sel, base, desk)).toEqual([]);
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
  const desk = (sel: string) => ap.find((x) => isDesktop(x.media) && x.selectors.includes(sel))?.body.replace(/\s+/g, ' ') ?? '';
  it('на ≥768 state — колонка 400 и всё по центру, donate — карточка 560; боковой padding 0 (иначе .ds-page съедает колонку)', () => {
    for (const [sel, w] of [['.ds-page.ap-main--state', 400], ['.ap-page--donate .ds-page.ap-main', 560]] as const) {
      for (const re of [new RegExp(`max-width: ${w}px`), /margin: auto/, /padding-left: 0/, /padding-right: 0/]) expect(desk(sel)).toMatch(re);
    }
    expect(desk('.ds-page.ap-main--state')).toMatch(/align-items: center; text-align: center/);
    expect(desk('.ap-donate-shell')).toMatch(/padding: 40px; border-radius: 28px/);
  });
  it('на ≥768 у state, donate и form шапка скрыта, «← На главную» показан внизу', () => {
    const pages = ['state', 'donate', 'form'];
    const hid = ap.filter((r) => r.selectors.some((s) => s.includes('.ds-sheet-head--page')) && /display:\s*none/.test(r.body));
    expect(hid.every((r) => isDesktop(r.media))).toBe(true);
    expect(hid.flatMap((r) => r.selectors).sort()).toEqual(pages.map((p) => `.ap-page--${p} .ds-sheet-head--page`).sort());
    const shown = ap.filter((r) => isDesktop(r.media) && /display:\s*inline-flex/.test(r.body)).flatMap((r) => r.selectors);
    for (const p of pages) expect(shown).toContain(`.ap-page--${p} .ap-home`);
  });
  it('форма на ≥768: у левой колонки .ap-info верхний отступ 88 (шапка скрыта, 56 + 32 как до волн)', () => {
    expect(desk('.ap-page--form .ap-info')).toMatch(/padding-top: 88px/);
  });
  it('client-more.css: правила .cm-page — только через ребёнка (.cm-page > …), листы внутри страницы не затрагиваются', () => {
    const leaks = readCss('client-more.css').flatMap((r) => r.selectors).filter((s) => /\.cm-page\s+[^>\s]/.test(s));
    expect(leaks).toEqual([]);
  });
});

describe('сверка ловит нарушение и пропускает исправленное', () => {
  const lg = (css: string) => unscopedPhone(parseRules(css), '.ds-btn--lg', WIDE);
  it('width: 100% у .ds-btn--lg: без медиа, в блоке касаний и под неканоническим ≤767 — красное; под PHONE_MEDIA — зелёное', () => {
    expect(lg('.ds-btn--lg { width: 100%; }')).toHaveLength(1);
    expect(lg('@media (pointer: coarse), (max-width: 767px) { .ds-btn--lg { width: 100%; } }')).toHaveLength(1);
    expect(lg('@media (max-width: 767px) { .ds-btn--lg { width: 100%; } }')).toHaveLength(1); // не каноническая строка (phoneLayout.test)
    expect(lg(`${PHONE} { .ds-btn--lg { width: 100%; } }`)).toEqual([]);
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
    expect(lgDecisionOk(parseRules(`${PHONE} { .st-done { width: 100%; } }`), 'own', '.st-done')).toBe(false);
    expect(lgDecisionOk(parseRules('.a { display: flex; flex-direction: column; align-items: center; }'), 'stretch', '.a')).toBe(false);
    expect(lgDecisionOk(parseRules('.a { display: flex; flex-direction: column; }'), 'stretch', '.a')).toBe(true);
    expect(lgDecisionOk(parseRules('@media (min-width: 768px) { .b { width: auto; } }'), 'content', '.b')).toBe(true);
  });
  it('display: none вне точного ≤767 (в т.ч. в блоке касаний) — красное', () => {
    const bad = (css: string) => parseRules(css).filter((r) => r.selectors.includes('.x') && /display:\s*none/.test(r.body) && !isPhone(r.media));
    expect(bad('.x { display: none; }')).toHaveLength(1);
    expect(bad('@media (pointer: coarse), (max-width: 767px) { .x { display: none; } }')).toHaveLength(1);
    expect(bad(`${PHONE} { .x { display: none; } }`)).toEqual([]);
  });
  it('телефон как в main: обёртка без contents или компьютерное объявление вне ≥768 — красное; под ≥768 — зелёное', () => {
    const v = (css: string, sel: string, base: RegExp | null, d: RegExp | null) => phoneBaseDesk(parseRules(css), sel, base, d);
    expect(v('.a { display: block; }', '.a', C, null)).not.toEqual([]);
    expect(v('.a { display: contents; }', '.a', C, null)).toEqual([]);
    expect(v(`.a { display: contents; } ${PHONE} { .a { display: inline-flex; } }`, '.a', C, /inline-flex/)).not.toEqual([]);
    expect(v('.a { display: contents; } @media (min-width: 768px) { .a { display: inline-flex; } }', '.a', C, /inline-flex/)).toEqual([]);
    expect(v('.t .s { margin-top: 4px; }', '.t .s', null, /margin/)).not.toEqual([]);
    expect(v('@media (min-width: 768px) { .t .s { margin-top: 4px; } }', '.t .s', null, /margin/)).toEqual([]);
  });
});
