// @vitest-environment node
// Глобальные правки примитивов и стили заготовок редизайна 2026-11 (b03, docs/design/APP_2026-11.md).
// CSS в jsdom не исполняется — сверяем исходники (приём dsPrimitives.test.ts):
//  • тумблер — мох палитры, не ярко-зелёный --ok; неактивная кнопка — утопленная бумага, а не
//    терракота на 50% («розовая и будто активная»); контурная простаивающая лежит в странице, занятая
//    (aria-busy) читается статусом; выбранный чип — бумага --h с кромкой тона;
//  • строка-переход со знаком слева — три колонки везде (одно правило в paper.css, paperRow.test.ts);
//  • подложка диалога — тёплый тон из токенов; «тихое» окно гасит кольцо автофокуса;
//  • paper-app.css: только токены, без размытия и фильтров, мелкий текст на цветной бумаге не
//    --text-faint (на ней ниже 4.5:1), правила против ds-* — на два класса (не полагаться на
//    порядок в сборке; место файла в каскаде — cascadePairs.test.ts).
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

  it('неактивная контурная (--secondary, --icon) хранит силуэт: без утопленной заливки, рамка --line', () => {
    for (const v of ['secondary', 'icon']) {
      const off = decls(cabinet, `.ds-btn.ds-btn--${v}:disabled`);
      expect(off, v).not.toContain('--paper-sunk');
      expect(off, v).toContain('background: transparent');
      expect(off, v).toContain('border-color: var(--line)');
      expect(decls(cabinet, `.ds-btn.ds-btn--${v}:disabled:hover`), v).toBe(off);
    }
  });

  // Ревью волны 0, круг 3: с белой плашкой и --text-faint простаивающая «Экспорт концепта» и «← Назад»
  // на первом вопросе читались нажимаемыми — у активной та же плашка и форма, разница в одном тоне.
  const prop = (d: string, p: string) => d.match(new RegExp(`(?:^|;)\\s*${p}:\\s*([^;]+)`))?.[1].trim();
  const active = decls(cabinet, '.ds-btn--secondary');
  const idle = decls(cabinet, '.ds-btn.ds-btn--secondary:disabled');
  const busy = decls(cabinet, ".ds-btn.ds-btn--secondary:disabled[aria-busy='true']");

  it('простаивающая неактивная контурная не похожа на активную: ни плашки, ни рамки, ни цвета подписи активной', () => {
    expect(prop(active, 'background')).toBe('var(--surface)');
    expect(prop(idle, 'background')).toBe('transparent');
    expect(prop(idle, 'border-color')).not.toBe(prop(active, 'border')?.split(' ').pop());
    expect(prop(idle, 'color')).not.toBe(prop(active, 'color'));
    // и не --text-faint: это обычный цвет вторичного текста, а не неактивный тон
    expect(prop(idle, 'color')).toMatch(/^color-mix\(in srgb, var\(--text-faint\) \d+%, transparent\)$/);
    expect(idle).not.toMatch(/opacity/);
  });

  it('на терракотовой карточке простаивающая контурная читается: плашка и --text-sub, не прозрачная', () => {
    // Регресс волны 0: «Сохранить» следующей сессии на ds-card--accent — подпись сливалась с заливкой.
    const onAccent = decls(cabinet, '.ds-card--accent .ds-btn.ds-btn--secondary:disabled');
    expect(prop(onAccent, 'background')).toMatch(/^color-mix\(in srgb, var\(--surface\) \d+%, var\(--accent\)\)$/);
    expect(prop(onAccent, 'color')).toBe('var(--text-sub)');
    expect(decls(cabinet, '.ds-card--accent .ds-btn.ds-btn--secondary:disabled:hover')).toBe(onAccent);
  });

  it('занятая контурная (aria-busy) — статус «Загружаю…»: плашка и --text-faint (≥4.5:1), не призрачная', () => {
    // --text-ghost в index.css — «только плейсхолдеры/декор, не текст»; ревью волны 0, круг 2
    expect(prop(busy, 'background')).toBe('var(--surface)');
    expect(prop(busy, 'color')).toBe('var(--text-faint)');
    expect(busy).not.toContain('--text-ghost');
    expect(decls(cabinet, ".ds-btn.ds-btn--secondary:disabled[aria-busy='true']:hover")).toBe(busy);
    expect(decls(cabinet, ".ds-btn:disabled[aria-busy='true']")).toContain('cursor: progress');
    expect(decls(cabinet, '.ds-btn.ds-btn--icon:disabled')).toContain('color: var(--text-ghost)');
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

  it('выбранный чип — бумага по --h (хрома бумаги, не конфета) с тёмной кромкой того же тона, текст основным цветом', () => {
    const on = decls(cabinet, '.ds-chip--toggle.is-on');
    const bg = on.match(/background: oklch\(([\d.]+) ([\d.]+) var\(--h, \d+\)\)/);
    expect(bg).toBeTruthy();
    expect(Number(bg![1])).toBeGreaterThanOrEqual(0.88);
    expect(Number(bg![2])).toBeLessThanOrEqual(0.04); // бумага .pp-paper — 0.03; 0.06 читался рыжим пятном
    // кромка темнее бумаги: состояние держится не одной жирностью (WCAG 1.4.11, к фону ≥3:1)
    const edge = on.match(/border-color: oklch\(([\d.]+) ([\d.]+) var\(--h, \d+\)\)/);
    expect(edge).toBeTruthy();
    expect(Number(edge![1])).toBeLessThanOrEqual(0.6);
    expect(Number(edge![2])).toBeLessThanOrEqual(0.05);
    expect(on).toContain('color: var(--text)');
    expect(on).toContain('font-weight: 600');
  });

  it('выбранный чип без --h у предков не прозрачный: у фона и кромки запасной оттенок', () => {
    // без запасного значения var(--h) недействителен, фон падает в transparent — выбранный
    // «Схемы» в брифе выглядел слабее невыбранных «Триггеров» (сверка стенда, F1)
    const on = decls(cabinet, '.ds-chip--toggle.is-on');
    const uses = on.match(/var\(--h[^)]*\)/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toBe('var(--h, 70)');
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

  it('«тихое» окно и лист (useQuietFocus) гасят кольцо и у кнопок внутри, и у себя — правило в index.css', () => {
    const index = rules('../index.css');
    expect(decls(index, "[data-focus='quiet'] :focus-visible")).toContain('outline: none');
    expect(decls(index, "[data-focus='quiet']:focus-visible")).toContain('outline: none');
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
  const narrow = src.match(/@container pa-sheet \(max-width: 440px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const px = (block: string, sel: RegExp) => Number(block.match(sel)?.[1]);

  it('узкий лист (≤440): картинка — в углу на строке надписи, заголовок и подпись на всю ширину', () => {
    expect(narrow).toMatch(/\.pa-sheet:not\(\.pa-sheet--plain\) > \.pa-sheet-body \{ display: contents; \}/);
    expect(narrow).toMatch(/\.pa-sheet:not\(\.pa-sheet--plain\) > \.pa-sheet-art \{[^}]*grid-row: 1;/);
    expect(narrow).toMatch(/:not\(\.pa-sheet-label\) \{ grid-column: 1 \/ -1;/);
  });

  it('узкий лист: знак 72 (compact и полоса — 56), своя сцена с данными — крупнее знака, а не 48 в колонке', () => {
    // на 48–60 тень-вырезка не видна, лист — пастельная карточка с иконкой (ревью волны 0, круг 2)
    expect(px(narrow, /\.pa-sheet\[data-sign\] > \.pa-sheet-art \{ width: (\d+)px/)).toBe(72);
    expect(px(narrow, /\.pa-sheet--compact\[data-sign\] > \.pa-sheet-art[^{]*\{ width: (\d+)px/)).toBe(56);
    const scene = px(narrow, /\.pa-sheet\.pa-sheet--scene > \.pa-sheet-art \{ width: (\d+)px/);
    expect(scene).toBeGreaterThanOrEqual(84);
    expect(scene).toBeLessThanOrEqual(96);
    expect(px(narrow, /\.pa-sheet--compact\.pa-sheet--scene > \.pa-sheet-art[^{]*\{ width: (\d+)px/)).toBeGreaterThan(56);
  });

  it('ширину картинки задаёт только слот: правил «> .scn» с шириной у листа нет (svg во flex-слоте их не слушал)', () => {
    const sheetRules = paperRules.filter((r) => r.selectors.some((x) => /\.pa-(sheet|spread)/.test(x)));
    for (const r of sheetRules) for (const x of r.selectors) expect(x, x).not.toMatch(/>\s*\.scn\b/);
  });

  it('подпись листа не обрезается нигде: ни в compact, ни в полосе разворота уже 1024 (ответ «откуда и зачем»)', () => {
    // полоса — первый экран потока; обрезка в две строки с многоточием прятала объяснение без
    // способа раскрыть его (frontend-visual.md: объяснение не прячется за медиавыражение)
    expect(src).not.toMatch(/line-clamp/);
    const strip = decls(paperRules, '.pa-spread-side .pa-sheet-sub');
    expect(strip).not.toMatch(/overflow:\s*hidden|display:\s*-webkit-box/);
    expect(decls(paperRules, '.pa-sheet--compact .pa-sheet-sub')).toBe(strip);
  });

  it('compact и лист разворота уже 1024 — полоса: Literata ≤24; колонка ≥1024 — своим контейнером', () => {
    const compactTitle = decls(paperRules, '.pa-sheet--compact .pa-sheet-title');
    expect(Number(compactTitle.match(/font-size: (\d+)px/)?.[1])).toBeLessThanOrEqual(24);
    expect(decls(paperRules, '.pa-spread-side .pa-sheet-title')).toBe(compactTitle);
    // на ≥1024 колонка разворота уходит из-под узких правил pa-sheet (знак сверху, Literata 32)
    expect(src).toMatch(/\.pa-spread-side \.pa-sheet \{\s*container-name: pa-spread-sheet;/);
  });

  it('полоса на планшете (лист ≥720) — знак крупнее 64: не мёртвая середина баннера', () => {
    const wide = src.match(/@container pa-sheet \(min-width: 720px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const strip = px(wide, /\.pa-sheet--compact \.pa-sheet-art, \.pa-spread-side \.pa-sheet-art \{ width: (\d+)px/);
    expect(strip).toBeGreaterThanOrEqual(96);
    expect(strip).toBeLessThanOrEqual(120);
  });

  it('знак в колонке разворота — по левому краю текста: поле холста знака снято сдвигом назад', () => {
    const column = src.slice(src.indexOf('container-name: pa-spread-sheet'));
    expect(column).toMatch(/\.pa-spread-side \.pa-sheet\[data-sign\] > \.pa-sheet-art \{ margin-left: -\d+px; \}/);
  });

  it('вариант мотива — пропом мотива, а не селектором внутрь svg знака', () => {
    // .pa-outcome-card[data-sign=check] … .pp-art:last-child rect перекрашивал не тот слой при любой
    // правке Check; плашку держит Check plate="surface" (SignHero, Sprout)
    for (const r of paperRules) for (const x of r.selectors) expect(x, x).not.toMatch(/\.pp-art|\brect\b|\bpath\b/);
  });

  it('второй лист в полосе исхода — целиком в полосе и тоном бумаги (хрома ≤0.04), а не обрывком', () => {
    const corner = decls(paperRules, '.pa-outcome-band::before');
    expect(corner).not.toMatch(/(right|bottom):\s*-/);
    expect(Number(corner.match(/oklch\([\d.]+ ([\d.]+) var\(--h\)\)/)?.[1])).toBeLessThanOrEqual(0.04);
  });

  it('слот знака у чипа — только с меткой (pa-chip--mark): у чипа без знака поля ровные', () => {
    expect(decls(paperRules, '.ds-chip.pa-chip--mark')).toContain('padding-left: 6px');
    expect(decls(paperRules, '.ds-chip.pa-chip')).toBe('');
  });

  it('размер листа-героя — по ширине самого листа (container query), разворот — с 1024', () => {
    expect(src).toMatch(/\.pa-sheet\s*\{[^}]*container:\s*pa-sheet \/ inline-size/);
    expect(src).toContain('@container pa-sheet (max-width: 400px)');
    expect(src).toContain('@media (min-width: 1024px) and (min-height: 501px), (min-width: 1024px) and (pointer: fine)');
  });
});
