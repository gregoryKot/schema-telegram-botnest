// @vitest-environment node
// Глобальные правки примитивов и стили заготовок редизайна 2026-11 (b03, docs/design/APP_2026-11.md).
// CSS в jsdom не исполняется — сверяем исходники (приём dsPrimitives.test.ts):
//  • тумблер — мох палитры, не ярко-зелёный --ok; неактивная кнопка — утопленная бумага, а не
//    терракота на 50% («розовая и будто активная»); выбранный чип — бумага --h без обводки;
//  • строка-переход со знаком слева — три колонки везде, а не только в «Ещё»;
//  • подложка диалога — тёплый тон из токенов; «тихое» окно гасит кольцо автофокуса;
//  • paper-app.css: только токены, без размытия и фильтров, мелкий текст на цветной бумаге не
//    --text-faint (на ней ниже 4.5:1), правила против ds-* — на два класса (файл может встать в
//    сборке раньше cabinet.css).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules, type Rule } from './cssRules.test-helpers';

const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');
const rules = (name: string): Rule[] => parseRules(read(name));
/** Объявления правил вне @media, где в списке селекторов стоит ровно `sel`. */
const decls = (rs: Rule[], sel: string) => rs.filter((r) => !r.media && r.selectors.includes(sel)).map((r) => r.body).join(';');

const cabinet = rules('cabinet.css');
const dialogs = rules('dialogs.css');
const paperApp = read('paper-app.css');
const paperRules = rules('paper-app.css');

describe('глобальные правки примитивов (cabinet.css)', () => {
  it('включённый тумблер — мох (--c-moss), не --ok', () => {
    const on = decls(cabinet, '.ds-switch[aria-checked="true"]');
    expect(on).toContain('var(--c-moss)');
    expect(on).not.toContain('--ok');
  });

  it('неактивная кнопка — утопленная бумага и бледный текст, без прозрачности; наведение её не красит', () => {
    const off = decls(cabinet, '.ds-btn:disabled');
    expect(off).toContain('background: var(--paper-sunk)');
    expect(off).toContain('color: var(--text-faint)');
    expect(off).not.toMatch(/opacity/);
    expect(decls(cabinet, '.ds-btn:disabled:hover')).toBe(off);
  });

  it('выбранный чип — бумага по --h, обводка прозрачная, текст основным цветом', () => {
    const on = decls(cabinet, '.ds-chip--toggle.is-on');
    expect(on).toMatch(/background: oklch\([^)]*var\(--h\)\)/);
    expect(on).toContain('border-color: transparent');
    expect(on).toContain('color: var(--text)');
  });

  it('строка-переход со знаком слева — три колонки глобально, не только под .cm-page', () => {
    expect(decls(cabinet, '.ds-list-row--nav:has(> .pp-row-art)')).toContain('grid-template-columns: 44px minmax(0, 1fr) auto');
  });
});

describe('диалоги (dialogs.css)', () => {
  it('подложка — тёплый тон из токенов (текст с долей акцента), без серо-оливкового --fg-rgb', () => {
    const bg = decls(dialogs, '.sk-dialog-backdrop');
    expect(bg).toMatch(/color-mix\(in srgb, color-mix\(in srgb, var\(--accent\) \d+%, var\(--text\)\) \d+%, transparent\)/);
    expect(bg).not.toContain('--fg-rgb');
  });

  it('«тихое» окно гасит кольцо и у кнопок внутри, и у самого окна', () => {
    expect(decls(dialogs, ".sk-dialog-box[data-focus='quiet'] :focus-visible")).toContain('outline: none');
    expect(decls(dialogs, ".sk-dialog-box[data-focus='quiet']:focus-visible")).toContain('outline: none');
  });

  it('опасная кнопка неактивной выглядит как все неактивные: её цвет — только у активной', () => {
    expect(decls(dialogs, '.ds-btn.sk-btn-danger:not(:disabled)')).toContain('var(--accent-red)');
    expect(decls(dialogs, '.ds-btn.sk-btn-danger')).toBe('');
  });
});

describe('paper-app.css — стили заготовок', () => {
  const src = paperApp.replace(/\/\*[\s\S]*?\*\//g, '');

  it('цвета — только токены и oklch по --h: без hex и rgb', () => {
    expect(src).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    const all = src.match(/oklch\(/g) ?? [];
    const byHue = src.match(/oklch\([\d.]+ [\d.]+ var\(--h\)\)/g) ?? [];
    expect(all.length).toBeGreaterThan(0);
    expect(byHue.length).toBe(all.length);
  });

  it('без размытия, фильтров и бесконечных анимаций (PWA, check-render-poison)', () => {
    expect(src).not.toMatch(/backdrop-filter|filter\s*:|blur\(|infinite/);
  });

  it('мелкий текст на цветной бумаге — не --text-faint', () => {
    const onPaper = paperRules.filter((r) => r.selectors.some((s) => /\.pa-(sheet|done|alert)/.test(s)));
    for (const r of onPaper) expect(r.body, r.selectors.join(', ')).not.toMatch(/(^|[;\s])color:\s*var\(--text-faint\)/);
  });

  it('правило, которое спорит с примитивом ds-*, — на два класса, а не на порядок в сборке', () => {
    for (const r of paperRules) {
      for (const s of r.selectors) {
        if (/\.ds-(btn|link|chip)\b/.test(s) && !/\s/.test(s)) expect(s, s).toMatch(/^\.ds-(btn|link|chip)\.pa-/);
      }
    }
  });

  it('размер листа-героя — по ширине самого листа (container query), разворот — с 1024', () => {
    expect(src).toMatch(/\.pa-sheet\s*\{[^}]*container:\s*pa-sheet \/ inline-size/);
    expect(src).toContain('@container pa-sheet (max-width: 400px)');
    expect(src).toContain('@media (min-width: 1024px) and (min-height: 501px), (min-width: 1024px) and (pointer: fine)');
  });
});
