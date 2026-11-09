// @vitest-environment node
// Сверка #925 «кабинет клиента на компьютере»: раскладки ≥768 живут под DESKTOP_MEDIA (phoneLayout.ts) и не протекают
// в телефон (≤767). CSS в jsdom не исполняется — читаем исходники (как desktopLayout.test.ts).
import { describe, it, expect } from 'vitest';
import { isPhone, isDesktop, readCss, indexCssRules, type Rule } from './cssRules.test-helpers';
import { DESKTOP_MEDIA } from '../utils/phoneLayout';

const media = (r: Rule) => r.media.replace(/\s+/g, ' ');
const rulesOf = (file: string, sel: string) => readCss(file).filter((r) => r.selectors.includes(sel));
/** Все объявления селектора вне ≥768 и вне ≥1024 — то есть те, что видит телефон. */
const phoneSees = (file: string, sel: string, decl: RegExp) =>
  rulesOf(file, sel).filter((r) => !/min-width:\s*(768|1024)px/.test(r.media) && decl.test(r.body));
// ≥768 — каноническая DESKTOP_MEDIA (телефон в альбомной ориентации остаётся телефоном); ≥1024 — та же пара с шириной 1024.
const DESK = { 768: `@media ${DESKTOP_MEDIA}`, 1024: `@media ${DESKTOP_MEDIA.replaceAll('768px', '1024px')}` } as const;
const at = (file: string, sel: string, w: 768 | 1024) =>
  rulesOf(file, sel).filter((r) => media(r) === DESK[w]).map((r) => r.body).join(' ');

describe('рамка клиентских страниц (client-frame.css)', () => {
  const frame = readCss('client-frame.css');
  it('колонка, центр и поля — переменные терапевта, только под ≥768', () => {
    expect(frame.length).toBeGreaterThan(0);
    for (const r of frame) expect(isDesktop(r.media)).toBe(true);
    const body = frame.find((r) => r.selectors.includes('.page > .ds-page'))?.body ?? '';
    expect(body).toMatch(/margin-left:\s*var\(--tk-center\)/);
    expect(body).toMatch(/max-width:\s*var\(--tk-max\)/);
    expect(body).toMatch(/padding-inline:\s*var\(--tk-gutter\)/);
  });
  it('--tk-* объявлены на .main (не только в кабинете) — рамка работает у клиента', () => {
    const main = indexCssRules().find((r) => r.media === '' && r.selectors.includes('.main'));
    expect(main?.body).toMatch(/--tk-max:\s*1440px/);
    expect(main?.body).toMatch(/--tk-center:/);
    expect(indexCssRules().some((r) => r.selectors.includes('.main--cabinet') && /--tk-/.test(r.body))).toBe(false);
  });
  it('телефон: общий .page > .ds-page без правил вне ≥768', () => {
    expect(frame.filter((r) => isPhone(r.media) || r.media === '')).toEqual([]);
  });
});

describe('«Сегодня»: ряд «трекер | квадраты» с 1024, иначе столбик', () => {
  const F = 'client-today.css';
  it('блок трекера рядом с квадратами — только с 1024; на телефоне сетки нет', () => {
    expect(at(F, '.ct-home', 1024)).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(phoneSees(F, '.ct-home', /grid-template-columns/)).toEqual([]);
  });
});

describe('«Записи»: шапка в строку и компактная дата', () => {
  const F = 'client-diary.css';
  it('шапка: герой слева и «Записать» справа в одну строку — только под ≥768', () => {
    expect(at(F, '.pp-block.cd-head', 768)).toMatch(/flex-direction:\s*row/);
    expect(at(F, '.pp-block.cd-head', 768)).toMatch(/justify-content:\s*space-between/);
    expect(phoneSees(F, '.pp-block.cd-head', /flex-direction:\s*row/)).toEqual([]);
  });
  // b11 (редизайн 2026-11, аудит diary-feed): дата — Literata 22 и на компьютере (была подпись 15px), колонкой
  // слева — по ширине самой страницы (container cd-page), а не окна: лист «Дневники» идёт без бокового меню.
  it('дата группы: Literata 22 везде; узкая колонка — только на широкой странице (container cd-page)', () => {
    const date = rulesOf(F, '.cd-day-date');
    expect(date.map((r) => r.media)).toEqual(['']);
    expect(date[0].body).toMatch(/font-size:\s*22px/);
    const wide = rulesOf(F, '.cd-day').filter((r) => /^@container cd-page \(min-width: \d+px\)$/.test(media(r)));
    expect(wide.map((r) => r.body).join(' ')).toMatch(/grid-template-columns:\s*\d+px\s+minmax\(0,\s*1fr\)/);
    expect(rulesOf(F, '.cd-day').filter((r) => r.media === '' && /grid-template-columns/.test(r.body))).toEqual([]);
  });
});

describe('«Ещё» и «Активность» на компьютере', () => {
  it('cm-phone-only скрыт только под ≥768; список и кризисная кнопка — колонка 720', () => {
    const hide = rulesOf('client-more.css', '.cm-phone-only');
    expect(hide.length).toBeGreaterThan(0);
    for (const r of hide) expect(isDesktop(r.media)).toBe(true);
    expect(phoneSees('client-more.css', '.cm-phone-only', /display:\s*none/)).toEqual([]);
    expect(at('client-more.css', '.cm-page > .ds-card--flush', 768)).toMatch(/max-width:\s*720px/);
    expect(at('client-more.css', '.cm-page > .ds-card--crisis', 768)).toMatch(/max-width:\s*720px/);
  });
  it('тепловая карта: клетка фиксированного размера ≤24px только под ≥768', () => {
    const grid = at('client-profile.css', '.cpf-heat-grid', 768);
    expect(Number(grid.match(/repeat\(var\(--cols\),\s*(\d+)px\)/)?.[1])).toBeLessThanOrEqual(24);
    expect(at('client-profile.css', '.cpf-heat-wrap', 768)).toMatch(/width:\s*max-content/);
    expect(rulesOf('client-profile.css', '.cpf-heat-wrap').filter((r) => !isDesktop(r.media) && /max-content/.test(r.body))).toEqual([]);
  });
});
