// @vitest-environment node
// Глобальные правки примитивов и стили заготовок редизайна 2026-11 (b03, docs/design/APP_2026-11.md).
// CSS в jsdom не исполняется — сверяем исходники (приём dsPrimitives.test.ts):
//  • тумблер — мох палитры, не ярко-зелёный --ok; неактивная кнопка — утопленная бумага, а не
//    терракота на 50% («розовая и будто активная»); выбранный чип — бумага --h с кромкой тона;
//  • строка-переход со знаком слева — три колонки везде, а не только в «Ещё»;
//  • подложка диалога — тёплый тон из токенов; «тихое» окно гасит кольцо автофокуса;
//  • paper-app.css: только токены, без размытия и фильтров, мелкий текст на цветной бумаге не
//    --text-faint (на ней ниже 4.5:1), правила против ds-* — на два класса (файл может встать в
//    сборке раньше cabinet.css).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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

  it('неактивная контурная (--secondary, --icon) хранит силуэт: без утопленной заливки, рамка --line, подпись гаснет', () => {
    for (const v of ['secondary', 'icon']) {
      const off = decls(cabinet, `.ds-btn.ds-btn--${v}:disabled`);
      expect(off, v).not.toContain('--paper-sunk');
      expect(off, v).toMatch(/background: var\(--surface\)|background: transparent/);
      expect(off, v).toContain('border-color: var(--line)');
      expect(off, v).toContain('color: var(--text-ghost)');
      expect(decls(cabinet, `.ds-btn.ds-btn--${v}:disabled:hover`), v).toBe(off);
    }
  });

  it('своя заливка у .ds-btn.x — с :not(:disabled) или с парой .ds-btn.x:disabled: исход не решает порядок файлов', () => {
    // .ds-btn:disabled (0,2,0) той же специфичности, что .ds-btn.x: без пары неактивная «← Назад»
    // была прозрачной только потому, что sheet-exercises.css стоял в сборке позже cabinet.css
    const all = readdirSync(__dirname).filter((n) => n.endsWith('.css')).flatMap((n) => rules(n).map((r) => ({ ...r, f: n })));
    const setsBg = (body: string) => /(^|;)\s*background(-color)?\s*:/.test(body);
    const classes = (sel: string) => new Set(sel.match(/\.[\w-]+/g) ?? []);
    const bad: string[] = [];
    for (const r of all.filter((x) => setsBg(x.body))) {
      for (const sel of r.selectors) {
        if (!/^\.ds-btn\.[\w-]+/.test(sel) || /:disabled|:hover|:active|:focus/.test(sel)) continue;
        const need = classes(sel);
        const paired = all.some((x) => setsBg(x.body) && x.selectors.some((t) =>
          /:disabled/.test(t) && !/:not\(:disabled\)/.test(t) && [...need].every((c) => classes(t).has(c))));
        if (!paired) bad.push(`${r.f}: ${sel}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('выбранный чип — бумага по --h с кромкой того же тона, текст основным цветом', () => {
    const on = decls(cabinet, '.ds-chip--toggle.is-on');
    expect(on).toMatch(/background: oklch\(0\.885 [\d.]+ var\(--h, \d+\)\)/);
    // кромка темнее бумаги: состояние держится не одной жирностью (WCAG 1.4.11, к фону ≥3:1)
    expect(on).toMatch(/border-color: oklch\(0\.5\d [\d.]+ var\(--h, \d+\)\)/);
    expect(on).toContain('color: var(--text)');
  });

  it('выбранный чип без --h у предков не прозрачный: у фона и кромки запасной оттенок', () => {
    // без запасного значения var(--h) недействителен, фон падает в transparent — выбранный
    // «Схемы» в брифе выглядел слабее невыбранных «Триггеров» (сверка стенда, F1)
    const on = decls(cabinet, '.ds-chip--toggle.is-on');
    const uses = on.match(/var\(--h[^)]*\)/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toBe('var(--h, 70)');
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

  it('коробка — сплошной сдвинутый слой бумаги из токена, без мягкой тени с размытием', () => {
    const box = decls(dialogs, '.sk-dialog-box');
    expect(box).toMatch(/box-shadow: \d+px \d+px 0 var\(--[\w-]+\)/);
    expect(box).not.toMatch(/rgba\(/);
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

  // Лист-герой не съедает первый экран потока (принцип 5: на 390 до первого поля — шапка и лист).
  // Разметку CSS jsdom не считает — сверяем правила; замер на стенде — с первым экраном-потребителем.
  it('узкий лист (≤440): знак в углу на строке надписи (≤64px), заголовок и подпись на всю ширину', () => {
    const narrow = src.match(/@container pa-sheet \(max-width: 440px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(narrow).toMatch(/\.pa-sheet\[data-sign\] > \.pa-sheet-body \{ display: contents; \}/);
    expect(narrow).toMatch(/\.pa-sheet\[data-sign\] > \.pa-sheet-art \{[^}]*grid-row: 1;[^}]*width: (5[6-9]|6[0-4])px/);
    expect(narrow).toMatch(/:not\(\.pa-sheet-label\) \{ grid-column: 1 \/ -1;/);
  });

  it('compact и лист разворота уже 1024 — полоса: Literata ≤24, подпись в две строки; колонка ≥1024 — своим контейнером', () => {
    const compactTitle = decls(paperRules, '.pa-sheet--compact .pa-sheet-title');
    expect(Number(compactTitle.match(/font-size: (\d+)px/)?.[1])).toBeLessThanOrEqual(24);
    expect(decls(paperRules, '.pa-spread-side .pa-sheet-title')).toBe(compactTitle);
    expect(decls(paperRules, '.pa-sheet--compact .pa-sheet-sub')).toMatch(/-webkit-line-clamp: 2/);
    // на ≥1024 колонка разворота уходит из-под узких правил pa-sheet (знак сверху, Literata 32)
    expect(src).toMatch(/\.pa-spread-side \.pa-sheet \{\s*container-name: pa-spread-sheet;/);
  });

  it('размер листа-героя — по ширине самого листа (container query), разворот — с 1024', () => {
    expect(src).toMatch(/\.pa-sheet\s*\{[^}]*container:\s*pa-sheet \/ inline-size/);
    expect(src).toContain('@container pa-sheet (max-width: 400px)');
    expect(src).toContain('@media (min-width: 1024px) and (min-height: 501px), (min-width: 1024px) and (pointer: fine)');
  });
});
