// @vitest-environment node
// Правила экрана против примитива на том же элементе (ревью g4, 2026-11). Каскад равной специфичности решает
// порядок `<link>` в сборке, а его задаёт раскрой чанков: CSS сборника sheet-tasks.css встаёт раньше index.css,
// и одноклассовое `.sk-fc-hero-label { color }` молча проигрывало `.ds-label { color: --text-faint }` из
// cabinet.css — надпись на розе «Мне плохо» выходила ≈4.2:1 при норме 4.5. Сверка держит:
//  • примитивы бумаги (paper-app.css) подключает только main.tsx после utilities.css — в главном чанке после
//    cabinet.css и paper.css, а не в общем чанке компонентов перед index.css;
//  • в CSS, который встаёт раньше index.css, класс, что стоит в разметке вместе с ds-label или pp-paper, не
//    спорит с ними одним классом по их же свойствам: правило — на два класса (.ds-label.x, .pp-paper.x).
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

/** Свойства примитива, которые одноклассовое правило экрана перебить не может, если CSS экрана встаёт раньше. */
const PRIMITIVES: Record<string, RegExp> = {
  'ds-label': /(^|[;\s{])(color|font-size|font-weight|letter-spacing|text-transform)\s*:/,
  'pp-paper': /(^|[;\s{])(background|color|border-radius)\s*:/,
};

/** Классы, что стоят в строковом className вместе с примитивом: `"ds-label sk-fc-row-label"` → sk-fc-row-label. */
function partnersOf(primitive: string): Set<string> {
  const out = new Set<string>();
  for (const { src } of sources) {
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{'([^']*)')/g)) {
      const cls = (m[1] ?? m[2]).split(/\s+/);
      if (cls.includes(primitive)) cls.filter((c) => c && c !== primitive).forEach((c) => out.add(c));
    }
  }
  return out;
}

describe('каскад экран против примитива', () => {
  it('paper-app.css подключает только main.tsx, после utilities.css и до App', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    const at = ["import '../../shared/src/theme/utilities.css'", "import './styles/paper-app.css'", "import App from"].map((s) => main.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const direct = sources.filter(({ f, src }) => f !== 'main.tsx' && /import\s+'[^']*paper-app\.css'/.test(src)).map(({ f }) => f);
    expect(direct).toEqual([]);
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
