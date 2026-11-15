// @vitest-environment node
// Старые классы дизайна до редизайна 2026-10 (.btn*, .chip*, .section, .aside-card) оставались в кабинете
// рядом с ds-*: «Карта себя», выбор «ты/вы», деталь достижения, «Дальше» пошаговых листов
// (docs/open/one-frontend.md). Лендинг, визитка, статьи и админка этими классами не пользуются (grep
// className 2026-11-08). С ними — мёртвые правила, пережившие раскрой CSS: .eyebrow, .ex-btn*, .tk2-done,
// .ss-row, .prompt, .flash*. Сверка: ни один className сайта и shared их не несёт, правил в CSS сайта нет.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const SHARED = join(SRC, '..', '..', 'shared', 'src');
const LEGACY = ['btn', 'btn-primary', 'btn-outline', 'chip', 'chip-success', 'aside-card', 'aside-card-eyebrow',
  'section', 'section-head', 'list-line', 'ex-btn-primary',
  'eyebrow', 'ex-btn', 'ex-btn-ghost', 'tk2-done', 'ss-row', 'prompt', 'flash', 'flash-q', 'dot'];

/** Классы из className="…" и литералов className={…}. */
function classTokens(src: string): string[] {
  return [...src.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
    .flatMap((m) => (m[1] ?? [...(m[2] ?? '').matchAll(/['"`]([^'"`]*)['"`]/g)].map((l) => l[1]).join(' ')).split(/\s+/));
}

/** Старые классы, у которых в CSS есть правило (селектор с `.класс` перед `{`); комментарии не в счёт. */
function cssRuleHits(css: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return LEGACY.filter((c) => new RegExp(`\\.${c}(?![\\w-])[^{}]*\\{`).test(bare));
}

const filesOf = (ext: string) => [SRC, SHARED].flatMap((root) =>
  (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => f.endsWith(ext) && !f.includes('.test.') && !f.includes('node_modules'))
    .map((f) => join(root, f)));

describe('старые классы и мёртвые правила — не возвращаются', () => {
  it('ни один className не несёт старый класс', () => {
    const files = filesOf('.tsx');
    expect(files.length).toBeGreaterThan(100);
    const bad = files.flatMap((f) => classTokens(readFileSync(f, 'utf8')).filter((c) => LEGACY.includes(c)).map((c) => `${f.slice(SRC.length - 10)}: ${c}`));
    expect(bad).toEqual([]);
  });

  it('в CSS сайта и shared правил старых классов нет', () => {
    const files = filesOf('.css');
    expect(files.length).toBeGreaterThan(100);
    const bad = files.flatMap((f) => cssRuleHits(readFileSync(f, 'utf8')).map((c) => `${f.slice(SRC.length - 10)}: .${c}`));
    expect(bad).toEqual([]);
  });

  it('контрольный образец: разбор className видит строку и литералы выражения', () => {
    expect(classTokens('<b className="btn btn-primary" />')).toContain('btn-primary');
    expect(classTokens("<b className={on ? 'chip chip-success' : 'ds-badge'} />")).toContain('chip-success');
    expect(classTokens('<b className="ds-btn ds-btn--secondary" />').some((c) => LEGACY.includes(c))).toBe(false);
  });

  it('контрольный образец: правило в списке селекторов находится, соседний класс и комментарий — нет', () => {
    expect(cssRuleHits('.cs-tile:focus-visible, .ss-row:focus-visible { outline: 0 }')).toEqual(['ss-row']);
    expect(cssRuleHits('.ex-btn-ghost:hover { color: red }')).toEqual(['ex-btn-ghost']);
    expect(cssRuleHits('.ss-rows, .pl2-eyebrow, .ds-btn { margin: 0 } /* .flash { } */')).toEqual([]);
  });
});
