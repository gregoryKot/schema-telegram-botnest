// @vitest-environment node
// Сверка #925 «кабинет клиента на компьютере»: раскладки ≥768 живут под @media (min-width: 768px) и не протекают
// в телефон (≤767). CSS в jsdom не исполняется — читаем исходники (как desktopLayout.test.ts).
import { describe, it, expect } from 'vitest';
import { isPhone, isDesktop, readCss, indexCssRules, type Rule } from './cssRules.test-helpers';

const media = (r: Rule) => r.media.replace(/\s+/g, ' ');
const rulesOf = (file: string, sel: string) => readCss(file).filter((r) => r.selectors.includes(sel));
/** Все объявления селектора вне ≥768 и вне ≥1024 — то есть те, что видит телефон. */
const phoneSees = (file: string, sel: string, decl: RegExp) =>
  rulesOf(file, sel).filter((r) => !/min-width:\s*(768|1024)px/.test(r.media) && decl.test(r.body));
const at = (file: string, sel: string, w: 768 | 1024) =>
  rulesOf(file, sel).filter((r) => media(r) === `@media (min-width: ${w}px)`).map((r) => r.body).join(' ');

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

describe('«Сегодня»: две колонки и ряд плиток', () => {
  const F = 'client-today.css';
  it('обёртки колонок на телефоне — display: contents; flex/grid только под ≥768/≥1024', () => {
    for (const sel of ['.ct-cols', '.ct-col']) {
      const base = rulesOf(F, sel).filter((r) => r.media === '' || r.selectors.length > 1);
      expect(base.some((r) => /display:\s*contents/.test(r.body))).toBe(true);
      expect(phoneSees(F, sel, /display:\s*(flex|grid)/)).toEqual([]);
    }
  });
  it('плитки в один ряд и две колонки заданий/ленты — только с 1024; на 768–1023 столбик', () => {
    expect(at(F, '.ct-tiles', 1024)).toMatch(/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(at(F, '.ct-cols', 1024)).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(phoneSees(F, '.ct-tiles', /grid-template-columns/)).toEqual([]);
    expect(phoneSees(F, '.ct-cols', /grid-template-columns/)).toEqual([]);
    expect(at(F, '.ct-cols', 768)).toMatch(/flex-direction:\s*column/);
  });
  it('раскладка плитки колонкой — только с 1024 (телефон: строка с иконкой слева)', () => {
    expect(at(F, '.ct-tile', 1024)).toMatch(/flex-direction:\s*column/);
    expect(phoneSees(F, '.ct-tile', /flex-direction:\s*column/)).toEqual([]);
  });
});

describe('«Записи»: шапка в строку и компактная дата', () => {
  const F = 'client-diary.css';
  it('.cd-top: на телефоне display: contents, строка «заголовок слева, кнопка справа» — под ≥768', () => {
    expect(rulesOf(F, '.cd-top').some((r) => r.media === '' && /display:\s*contents/.test(r.body))).toBe(true);
    expect(phoneSees(F, '.cd-top', /display:\s*flex/)).toEqual([]);
    expect(at(F, '.cd-top', 768)).toMatch(/display:\s*flex[^}]*justify-content:\s*space-between|justify-content:\s*space-between[^}]*display:\s*flex/);
  });
  it('дата группы: подпись мелким шрифтом и узкая колонка — под ≥768; телефонный размер 22px не тронут', () => {
    const date = at(F, '.cd-day-date', 768);
    expect(Number(date.match(/(\d+)px/)?.[1])).toBeLessThanOrEqual(16);
    expect(at(F, '.cd-day', 768)).toMatch(/grid-template-columns:\s*\d+px\s+minmax\(0,\s*1fr\)/);
    const phone = readCss(F).filter((r) => isPhone(r.media) && r.selectors.includes('.cd-day-date'));
    expect(phone.map((r) => r.body)).toEqual([expect.stringMatching(/font-size:\s*22px/)]);
  });
});
