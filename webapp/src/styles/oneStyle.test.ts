// @vitest-environment node
// Сверка правил «один стиль», которые держат все экраны, а не один примитив
// (#906, волна 3): разделитель, два кегля засечного, ритм страницы, высота
// навигации. Читает все styles/*.css, index.css и .tsx пакета (без тестов).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const stripC = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const cssFiles = readdirSync(__dirname).filter((f) => f.endsWith('.css'));
const cssText = (f: string) => stripC(readFileSync(join(__dirname, f), 'utf8'));
const indexCss = stripC(readFileSync(join(SRC, 'index.css'), 'utf8'));

type Rule = { subjects: string[]; body: string };
/** Самые внутренние правила; «субъект» — последний составной селектор. */
function rules(css: string): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    subjects: m[1].split(',').map((s) => s.trim().split(/[\s>+~]+/).pop() ?? ''),
    body: m[2],
  }));
}
const hasClass = (subject: string, cls: string) => new RegExp(`\\.${cls}(?![\\w-])`).test(subject);
const declares = (body: string, props: string[]) =>
  body.split(';').some((d) => props.includes(d.split(':')[0].trim()));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return /\.tsx$/.test(e.name) && !/\.(test|test-helpers)\.tsx$/.test(e.name) ? [p] : [];
  });
}

/** Литералы выражения; ветки тернарника (`a ? 'x' : 'y'`) — взаимоисключающие, каждая со своим списком. */
const literals = (e: string) => [...e.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)]
  .map((l) => (l[1] ?? l[2] ?? l[3]).replace(/\$\{[^}]*\}/g, ' ')).join(' ');

/** Классы каждого className: строка в кавычках или литералы выражения в {}. */
function classLists(src: string): string[][] {
  const out: string[][] = [];
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{)/g)) {
    let texts = [m[1] ?? ''];
    if (m[1] === undefined) {
      let depth = 1, i = m.index! + m[0].length;
      const start = i;
      for (; i < src.length && depth > 0; i++) depth += src[i] === '{' ? 1 : src[i] === '}' ? -1 : 0;
      const [head, ...alts] = src.slice(start, i - 1).split(/\s\?\s|\s:\s/);
      texts = [literals(head), ...alts.map((a) => `${literals(head)} ${literals(a)}`)];
    }
    for (const t of texts) out.push(t.split(/\s+/).filter((x) => /^[a-zA-Z][\w-]*$/.test(x)));
  }
  return out;
}
const lists = walk(SRC).flatMap((f) => classLists(readFileSync(f, 'utf8')).map((l) => ({ f: f.slice(SRC.length + 1), l })));
const allRules = [...cssFiles.flatMap((f) => rules(cssText(f)).map((r) => ({ ...r, f }))), ...rules(indexCss).map((r) => ({ ...r, f: 'index.css' }))];

/** --line в border-top/bottom — только у контуров: край полосы или рамка самостоятельного блока. */
const LINE_OUTLINES: Record<string, string> = {
  '.ds-sheet-head': 'нижний край шапки листа',
  '.pl2-header': 'нижний край закреплённой шапки лендинга и мини-тестов',
  '.tk-head': 'нижний край шапки трекера',
  '.tq-bar': 'нижний край верхней полосы вопроса',
  '.ss-tabs': 'нижний край полосы вкладок справочника',
  '.mm2-bar': 'нижний край полосы выбора карт',
  '.mm2-statusbar': 'нижний край полосы статуса над холстом карты',
  '.th-card': 'рамка самостоятельной карточки (три стороны + акцент слева)',
};
const selectorsOf = (css: string, re: RegExp) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => re.test(m[2])).map((m) => m[1].trim());
const LINE_BORDER = /border-(?:top|bottom):\s*1px\s+solid\s+var\(--line\)/;

describe('один токен разделителя', () => {
  // Разделитель строк, разделов и футеров — --paper-sunk; --line — контуры из списка выше; на песочной панели — --panel-line.
  it.each(cssFiles)('%s: линии 1px — solid и токен разделителя/контура', (f) => {
    const bad = [...cssText(f).matchAll(/border-(?:top|bottom):\s*1px\s+(\w+)\s+(var\([^)]*\)|[^;}\s]+)/g)]
      .filter((m) => m[1] !== 'solid' || !/^var\(--(line|paper-sunk|panel-line)\)$/.test(m[2])).map((m) => m[0]);
    expect(bad).toEqual([]);
  });
  it.each(cssFiles)('%s: --line в border-top/bottom только у контуров из списка', (f) => {
    const bad = selectorsOf(cssText(f), LINE_BORDER).filter((sel) => !(sel in LINE_OUTLINES));
    expect(bad).toEqual([]);
  });
  it('гейт ловит разделитель на --line и пропускает контур', () => {
    expect(selectorsOf('.x-row + .x-row { border-top: 1px solid var(--line); }', LINE_BORDER)).toEqual(['.x-row + .x-row']);
    expect(selectorsOf('.ds-sheet-head { border-bottom: 1px solid var(--line); }', LINE_BORDER).every((s) => s in LINE_OUTLINES)).toBe(true);
    expect(selectorsOf('.x-row { border-top: 1px solid var(--paper-sunk); }', LINE_BORDER)).toEqual([]);
  });
});

describe('цепочка режимов концептуализации', () => {
  it('тело карточки узла объявлено для .tcp-node, а не только для первого', () => {
    const css = cssText('therapist-concept.css');
    const body = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].trim() === '.tcp-node')?.[2] ?? '';
    expect(body).toMatch(/border:/);
    expect(body).toMatch(/padding:/);
    expect(css).not.toMatch(/:first-child\s+\.tcp-node\s*\{[^}]*(border|padding|background)/);
  });
});

describe('два кегля засечного', () => {
  it.each(cssFiles.filter((f) => f !== 'cabinet.css'))('%s: у правил ds-h1/h2/h3 нет font-size и font:', (f) => {
    const bad = rules(cssText(f)).filter((r) => r.subjects.some((s) => /\.ds-h[123](?![\w-])/.test(s)) && declares(r.body, ['font-size', 'font']));
    expect(bad.map((r) => r.subjects.join(','))).toEqual([]);
  });
  it('в .tsx у соседа ds-h* по className нет своего кегля в css', () => {
    const bad = new Set<string>();
    for (const { f, l } of lists) {
      if (!l.some((c) => /^ds-h[123]$/.test(c))) continue;
      for (const c of l.filter((x) => !/^ds-h[123]$/.test(x))) {
        if (allRules.some((r) => r.subjects.some((s) => hasClass(s, c)) && declares(r.body, ['font-size', 'font']))) bad.add(`${f}: ${c}`);
      }
    }
    expect([...bad]).toEqual([]);
  });
});

describe('ритм страницы — только от ds-page', () => {
  const pageClasses = new Set(['ds-page']);
  for (const { l } of lists) if (l.includes('ds-page')) l.forEach((c) => pageClasses.add(c));
  it.each(cssFiles.filter((f) => f !== 'cabinet.css'))('%s: у страниц нет gap и вертикальных padding', (f) => {
    const bad = rules(cssText(f)).filter((r) => r.subjects.some((s) => [...pageClasses].some((c) => hasClass(s, c)))
      && declares(r.body, ['gap', 'row-gap', 'padding', 'padding-top', 'padding-bottom', 'padding-block']));
    expect(bad.map((r) => r.subjects.join(','))).toEqual([]);
  });
  // Инлайн-стиль css-сверка не видит: силуэт «Сегодня» (AppShellSkeleton) держал gap: 24 при ds-page.
  const inlineRhythm = (src: string) => [...src.matchAll(/<\w+\s[^<>]*?\bds-page\b[^<>]*>/g)]
    .map((m) => m[0]).filter((tag) => /style=\{\{[^}]*\b(gap|rowGap|padding|paddingTop|paddingBottom|paddingBlock)\s*:/.test(tag));
  it('в .tsx у тега с ds-page нет инлайн gap и вертикальных padding', () => {
    const bad = walk(SRC).flatMap((f) => inlineRhythm(readFileSync(f, 'utf8')).map((t) => `${f.slice(SRC.length + 1)}: ${t}`));
    expect(bad).toEqual([]);
  });
  it('сверка ловит инлайн-ритм у ds-page и пропускает ширину', () => {
    expect(inlineRhythm('<div className="ds-page" style={{ maxWidth: 600, gap: 24 }}>')).toHaveLength(1);
    expect(inlineRhythm('<div className="ds-page" style={{ maxWidth: 600, paddingLeft: 8 }}>')).toEqual([]);
  });
});

describe('высота навигации: документ = код', () => {
  it('REDESIGN: «нижний таб-бар» с h<--mobile-nav-h>, без h76', () => {
    const n = indexCss.match(/--mobile-nav-h:\s*(\d+)px/)?.[1];
    expect(n).toBeTruthy();
    const doc = readFileSync(join(__dirname, '../../../docs/design/REDESIGN_2026-10.md'), 'utf8');
    const line = doc.split('\n').find((s) => s.includes('нижний таб-бар')) ?? '';
    expect(line).toContain(`h${n}`);
    expect(line).not.toContain('h76');
  });
});

// #920 переименовал группу --ink…/--on-ink… в --panel…/--on-panel…. var() без объявления
// не роняет ни сборку, ни консоль: свойство молча теряет значение (тень и затенение под
// «Мне плохо» и текстом согласия пропали при сведении ветки, начатой до #920).
describe('снятые токены --ink/--on-ink нигде не читаются (#920)', () => {
  const OLD = /var\(--(on-)?ink(-[\w-]+)?\)/;
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : files(p);
    return /\.(css|tsx?)$/.test(e.name) && !/\.test(-helpers)?\.tsx?$/.test(e.name) ? [p] : [];
  });
  it('webapp/src и shared/src: нет var(--ink…) и var(--on-ink…)', () => {
    const bad = [...files(SRC), ...files(join(SRC, '../../shared/src'))]
      .filter((f) => OLD.test(stripC(readFileSync(f, 'utf8'))));
    expect(bad).toEqual([]);
  });
  it('сверка ловит старое имя и пропускает --warn-ink, --ok-ink, --panel', () => {
    for (const bad of ['var(--ink)', 'var(--on-ink-faint)', 'color-mix(in srgb, var(--ink) 25%, transparent)']) expect(OLD.test(bad), bad).toBe(true);
    for (const ok of ['var(--warn-ink)', 'var(--ok-ink)', 'var(--panel)', 'var(--on-panel-faint)']) expect(OLD.test(ok), ok).toBe(false);
  });
});
