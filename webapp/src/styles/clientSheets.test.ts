// @vitest-environment node
// Клиент: «Настройки», «Записи» и история, «Паттерны» (#906, волна 2, срез S4):
// строки, сегменты, раскрывашка и пустые состояния — общие ds-* из cabinet.css,
// локальные копии удалены. CSS в jsdom не исполняется, поэтому сверяем строки
// файлов (приём dsPrimitives.test.ts): удалённых классов нет, нужные правила есть.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** Правила файла как [селекторы, тело]. */
const rulesOf = (css: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].split(',').map((s) => s.trim()), m[2]] as const);
/** Селекторы файла по одному. */
const selectors = (css: string) => rulesOf(css).flatMap(([sels]) => sels);
/** Есть ли селектор, содержащий класс `.cls` как целое имя (не префикс `.cls-x`). */
const hasClass = (css: string, cls: string) =>
  selectors(css).some((s) => new RegExp(`\\.${cls}(?![\\w-])`).test(s));

const settings = read('sheet-settings.css');
const diary = read('client-diary.css');
const schemas = read('client-schemas.css');
const sheetDiary = read('sheet-diary.css');
const pattern = read('pattern-sheet.css');

describe('Настройки: строки и переключатель режима — общие примитивы', () => {
  it.each(['st-row', 'st-chev', 'st-chev--sm', 'st-chev-arrow', 'st-row-title', 'st-row-sub', 'st-row--click', 'sb-mode-switch--sheet'])(
    'в sheet-settings.css нет .%s', (cls) => expect(hasClass(settings, cls)).toBe(false));
  it('у .ds-link в настройках нет локальной высоты 44 (её даёт cabinet.css)', () => {
    for (const [sels, body] of rulesOf(settings)) {
      if (sels.some((s) => s.includes('.ds-link'))) expect(body).not.toMatch(/min-height/);
    }
  });
  it('в sheet-settings.css нет .st-row--danger: опасную строку красит ds-list-row--danger (cabinet.css)', () => {
    expect(hasClass(settings, 'st-row--danger')).toBe(false);
  });
  it.each(['st-opt', 'st-hour', 'st-link-danger', 'st-pc-write', 'st-pc-leave'])(
    'в sheet-settings.css нет .%s (общие ds-list-row, ds-chip--toggle, ds-link--danger)', (cls) =>
      expect(hasClass(settings, cls)).toBe(false));
  it('в sheet-settings.css нет селектора .st-links a', () => {
    expect(selectors(settings).filter((s) => s.includes('.st-links a'))).toEqual([]);
  });
});

describe('Записи и история', () => {
  it('в client-diary.css нет оверрайдов сегмента', () => {
    expect(selectors(diary).filter((s) => s.includes('.cd-bar .ds-'))).toEqual([]);
  });
  it('в sheet-diary.css нет копий пустого состояния, ссылок и строк-переходов', () => {
    for (const cls of ['sd-explainer-wrap', 'sd-explainer-title', 'sd-explainer-intro', 'sd-explainer-foot',
      'sd-weekly-empty', 'sd-empty-title', 'sd-empty-text', 'sd-backfill', 'sd-backfill-title']) {
      expect(hasClass(sheetDiary, cls)).toBe(false);
    }
    expect(selectors(sheetDiary)).not.toContain('.sd-links .ds-link');
  });
  it('карточки-объяснялки пустого дневника — 14px, не кегль карточки по умолчанию', () => {
    expect(sheetDiary).toMatch(/\.sd-explainer-card\s*\{[^}]*font-size:\s*14px/);
    expect(sheetDiary).toMatch(/\.sd-explainer-why\s*\{[^}]*font-size:\s*13px/);
  });
  it('пустые состояния дневника и истории без курсива', () => {
    for (const [sels, body] of rulesOf(sheetDiary)) {
      if (sels.some((s) => /\.sd-(explainer|empty)/.test(s))) expect(body).not.toMatch(/font-style:\s*italic/);
    }
  });
});

describe('Паттерны', () => {
  it.each(['cs-seg', 'cs-fold-btn', 'cs-fold', 'cs-fold-chev', 'cs-empty', 'cs-tools'])(
    'в client-schemas.css нет .%s', (cls) => expect(hasClass(schemas, cls)).toBe(false));
  it('в client-schemas.css нет .cs-row: строка группы — ds-list-row', () =>
    expect(hasClass(schemas, 'cs-row')).toBe(false));
  it.each(['ps-empty', 'ps-pill'])('в pattern-sheet.css нет .%s', (cls) =>
    expect(hasClass(pattern, cls)).toBe(false));
  it.each(['cpf-delete-link', 'cpf-danger'])('в client-profile.css нет .%s (ds-link--danger, ds-list-row--danger)', (cls) =>
    expect(hasClass(read('client-profile.css'), cls)).toBe(false));
  it('в auth-pay.css нет .ap-field: поле email — ds-input--on-ink', () =>
    expect(hasClass(read('auth-pay.css'), 'ap-field')).toBe(false));
});
