// @vitest-environment node
// Правила экрана против примитива на том же элементе (ревью g4, 2026-11). Каскад равной специфичности решает
// порядок `<link>` в сборке, а его задаёт раскрой чанков: CSS сборника sheet-tasks.css встаёт раньше index.css,
// и одноклассовое `.sk-fc-hero-label { color }` молча проигрывало `.ds-label { color: --text-faint }` из
// cabinet.css — надпись на розе «Мне плохо» выходила ≈4.2:1 при норме 4.5. Сверка держит:
//  • примитивы бумаги (paper-app.css) подключает только main.tsx после utilities.css — в главном чанке после
//    cabinet.css и paper.css, а не в общем чанке компонентов перед index.css;
//  • в CSS, который встаёт раньше index.css, класс, что стоит в разметке вместе с ds-label или pp-paper, не
//    спорит с ними одним классом по их же свойствам: правило — на два класса (.ds-label.x, .pp-paper.x).
//    Сосед — и класс из пропа className примитива, который сам рисует pp-paper (PaperAlert, EntitySheet:
//    `<PaperAlert className="sk-fc-alert">` кладёт sk-fc-alert на тот же элемент, ревью g4 r2).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cssBundle } from './cssBundle.test-helpers';
import { parseRules } from './cssRules.test-helpers';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}
const sources = walk(SRC).map((f) => ({ f: f.slice(SRC.length + 1), src: readFileSync(f, 'utf8') }));
const cssFiles = (function walkCss(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walkCss(p);
    return e.name.endsWith('.css') ? [p] : [];
  });
})(SRC);

/** Примитивы, что кладут проп className на свой корень с примитивом (корень — в их файле, сверка ниже). */
const ROOT_CLASS_PROP: Record<string, Record<string, string>> = {
  'pp-paper': { PaperAlert: 'components/paper/PaperAlert.tsx', EntitySheet: 'components/paper/EntitySheet.tsx' },
};

/** Свойства примитива, которые одноклассовое правило экрана перебить не может, если CSS экрана встаёт раньше. */
const PRIMITIVES: Record<string, RegExp> = {
  'ds-label': /(^|[;\s{])(color|font-size|font-weight|letter-spacing|text-transform)\s*:/,
  'pp-paper': /(^|[;\s{])(background|color|border-radius)\s*:/,
};

/** Классы, что стоят в строковом className вместе с примитивом: `"ds-label sk-fc-row-label"` → sk-fc-row-label. */
function partnersOf(primitive: string): Set<string> {
  const out = new Set<string>();
  const owners = Object.keys(ROOT_CLASS_PROP[primitive] ?? {});
  // `<PaperAlert sign="cup" onRetry={() => x} className="sk-fc-alert"` — между именем и className нет тегов.
  const viaProp = owners.length ? new RegExp(`<(?:${owners.join('|')})\\b(?:[^<>]|=>)*?className=(?:"([^"]*)"|\\{'([^']*)')`, 'g') : null;
  for (const { src } of sources) {
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{'([^']*)')/g)) {
      const cls = (m[1] ?? m[2]).split(/\s+/);
      if (cls.includes(primitive)) cls.filter((c) => c && c !== primitive).forEach((c) => out.add(c));
    }
    if (viaProp) for (const m of src.matchAll(viaProp)) (m[1] ?? m[2]).split(/\s+/).filter(Boolean).forEach((c) => out.add(c));
  }
  return out;
}

describe('каскад экран против примитива', () => {
  it('paper-app.css подключает только main.tsx, после utilities.css и до App', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    const at = ["import '../../shared/src/theme/utilities.css'", "import './styles/paper-app.css'", "import App from"].map((s) => main.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const direct = sources.filter(({ f, src }) => f !== 'main.tsx' && /import\s+['"][^'"]*paper-app\.css['"]/.test(src)).map(({ f }) => f);
    expect(direct).toEqual([]);
    // Обход через CSS: `@import './paper-app.css'` из файла экрана увёл бы примитивы в его чанк.
    const viaCss = cssFiles.filter((f) => /@import\s+(?:url\()?\s*['"]?[^'")]*paper-app\.css/.test(readFileSync(f, 'utf8')));
    expect(viaCss).toEqual([]);
  });

  it('проп className примитивов-бумаги ложится на корень с pp-paper — их соседи в сверке', () => {
    for (const [name, file] of Object.entries(ROOT_CLASS_PROP['pp-paper'])) {
      const src = readFileSync(join(SRC, file), 'utf8');
      expect(src, name).toMatch(/'pp-paper[^']*'[\s\S]{0,120}className|className[\s\S]{0,160}'pp-paper/);
    }
    // Образец: наклейка сбоя на итоге «Мне плохо» — <PaperAlert className="sk-fc-alert">.
    expect(partnersOf('pp-paper').has('sk-fc-alert')).toBe(true);
    // Контрольный образец: класс из className обычного элемента без примитива соседом не считается.
    expect(partnersOf('pp-paper').has('sk-fc-links')).toBe(false);
  });

  // sheet-tasks.css стоит в сборке перед index.css; файлы кризиса, дыхания и «Практик» компоненты подключают
  // сами, и их чанк зависит от раскроя (лист дыхания живёт и в ⌘K, и в итоге разбора).
  const EARLY = ['sheet-tasks.css', 'breathing.css', 'quick-practice.css', 'client-practice.css', 'practice-selfhelp.css'];
  const cases = Object.keys(PRIMITIVES).flatMap((p) => EARLY.map((f) => [p, f] as const));
  it.each(cases)('соседи %s в %s — на два класса', (primitive, file) => {
    const partners = partnersOf(primitive);
    expect(partners.size).toBeGreaterThan(0);
    const bad = parseRules(cssBundle(file))
      .flatMap((r) => r.selectors.filter((s) => /^\.[\w-]+$/.test(s) && partners.has(s.slice(1)) && PRIMITIVES[primitive].test(r.body)))
      .filter((s, i, a) => a.indexOf(s) === i);
    expect(bad).toEqual([]);
  });

  it('образец: надписи «Мне плохо» — .ds-label.sk-fc-*, цвет --text-sub', () => {
    const rules = parseRules(cssBundle('sheet-tasks.css'));
    for (const c of ['sk-fc-hero-label', 'sk-fc-row-label', 'sk-fc-voice-label', 'sk-fc-need-label', 'sk-fc-date']) {
      expect(partnersOf('ds-label').has(c), c).toBe(true);
      const body = rules.filter((r) => r.selectors.includes(`.ds-label.${c}`)).map((r) => r.body).join(';');
      expect(body, c).toMatch(/color:\s*var\(--text-sub\)/);
    }
  });
});
