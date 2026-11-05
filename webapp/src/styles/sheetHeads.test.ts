// @vitest-environment node
// Шапки листов и страниц (#906, волна 1, срез C2): «← Назад/Закрыть» и заголовок —
// только общие .ds-sheet-head/.ds-back/.ds-h2 из cabinet.css; локальные копии
// шапки, заголовка и кнопок (.st-head/.st-title, .aa-back/.aa-h1, .ap-back/.ap-h1/
// .ap-btn, .ex2-back, .sd-back …) удалены вместе с заменой. CSS в jsdom не
// исполняется, поэтому сверяем строки исходников (приём safeTop.test.ts); рендер
// шапок — в тестах самих компонентов (getByRole('button'|'link', …) → .ds-back).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Правила файла (вложенные в @media тоже): список селекторов и тело. */
function rules(css: string): { selectors: string[]; body: string }[] {
  return [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(',').map((s) => s.trim()),
    body: m[2],
  }));
}
const classesOf = (sel: string) => sel.match(/\.[a-zA-Z0-9_-]+/g) ?? [];

const FILES = ['sheet-settings.css', 'auth-account.css', 'auth-pay.css', 'sheet-exercises.css', 'sheet-diary.css', 'client-schemas.css', 'sheet-tasks.css', 'sheet-schemas.css'] as const;
const css = Object.fromEntries(FILES.map((f) => [f, read(f)])) as Record<(typeof FILES)[number], string>;

/** Локальные копии шапки, заголовка и кнопок, ушедшие вместе с заменой на ds-*. */
const REMOVED = [
  '.st-head', '.st-title',
  '.aa-back', '.aa-h1', '.aa-card-title', '.aa-count', '.aa-foot-all',
  '.ap-page--center', '.ap-h1', '.ap-h1--sm', '.ap-back', '.ap-btn', '.ap-donate-cta', '.ap-card', '.ap-icon', '.ap-thanks',
  '.ex2-back', '.sd-back',
  '.cs-sheet-head', '.cs-sheet-back', '.sk-top', '.sk-back', '.ss-bar', '.ss-back',
];
/** Свой класс «back»/«title»/«h1» у любого префикса среза: кегль задаёт только ds-*. */
const HEAD_CLASS = /^\.(?:st|aa|ap|ex2|sd)-(?:back|title|h1)(?:--[a-z0-9-]+)?$/;
/** Обёртки над ds-sub/ds-h1/ds-h2, оставленные ради отступов: кегля не задают. */
const NO_FONT_SIZE = ['.ap-lead', '.aa-lead', '.ex2-title', '.sd-journey-title'];

describe('шапки листов и страниц — только ds-sheet-head/ds-back (#906)', () => {
  it.each(REMOVED)('%s не объявлен ни в одном css среза', (cls) => {
    for (const f of FILES) {
      const hit = rules(css[f]).filter((r) => r.selectors.some((s) => classesOf(s).includes(cls)));
      expect(hit.map((r) => r.selectors.join(', ')), `${cls} в ${f}`).toEqual([]);
    }
  });

  it.each(FILES)('%s: свои классы back/title/h1 и обёртки над ds-* не задают кегль', (f) => {
    const bad = rules(css[f]).filter(
      (r) =>
        r.selectors.some((s) => classesOf(s).some((c) => HEAD_CLASS.test(c) || NO_FONT_SIZE.includes(c))) &&
        /font(?:-size)?\s*:/.test(r.body),
    );
    expect(bad.map((r) => r.selectors.join(', '))).toEqual([]);
  });

  it('auth-pay.css: на телефоне страницы прижаты к верху и влево — центрирование только в блоке для компьютера (с .ap-page--state)', () => {
    const phoneCss = css['auth-pay.css'].split('.ap-page--state')[0];
    const page = rules(phoneCss).filter((r) => r.selectors.some((s) => classesOf(s).includes('.ap-page')));
    expect(page.length).toBeGreaterThan(0);
    for (const r of page) expect(r.body, r.selectors.join(', ')).not.toMatch(/(?:align-items|justify-content):\s*center/);
    expect(phoneCss).not.toContain('text-align: center');
    expect(css['auth-pay.css']).toContain('.ap-page--state');
  });

  it('экран упражнения: .ex2-top несёт только липкость и --safe-top, вид шапки — у .ds-sheet-head', () => {
    const top = rules(css['sheet-exercises.css']).filter((r) => r.selectors.includes('.ex2-top'));
    expect(top.length).toBeGreaterThan(0);
    for (const r of top) expect(r.body, r.selectors.join(', ')).not.toMatch(/border|background|display|padding: 0/);
  });
});
