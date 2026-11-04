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

describe('один токен разделителя', () => {
  // Разделитель — --paper-sunk (как в «Настройках»); --line — контуры; на тёмном — --ink-line.
  it.each(cssFiles)('%s: линии 1px — solid и токен разделителя/контура', (f) => {
    const bad = [...cssText(f).matchAll(/border-(?:top|bottom):\s*1px\s+(\w+)\s+(var\([^)]*\)|[^;}\s]+)/g)]
      .filter((m) => m[1] !== 'solid' || !/^var\(--(line|paper-sunk|ink-line)\)$/.test(m[2])).map((m) => m[0]);
    expect(bad).toEqual([]);
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
