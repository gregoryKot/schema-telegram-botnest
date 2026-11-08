// @vitest-environment node
// Старые классы дизайна до редизайна 2026-10 (.btn*, .chip*, .section, .aside-card) оставались в кабинете
// рядом с ds-*: «Карта себя», выбор «ты/вы», деталь достижения, «Дальше» пошаговых листов
// (docs/open/one-frontend.md). Лендинг, визитка, статьи и админка этими классами не пользуются (grep
// className 2026-11-08). Сверка: ни один className сайта и shared их не несёт, правил в index.css нет.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const LEGACY = ['btn', 'btn-primary', 'btn-outline', 'chip', 'chip-success', 'aside-card', 'aside-card-eyebrow',
  'section', 'section-head', 'list-line', 'ex-btn-primary'];

/** Классы из className="…" и литералов className={…}. */
function classTokens(src: string): string[] {
  return [...src.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
    .flatMap((m) => (m[1] ?? [...(m[2] ?? '').matchAll(/['"`]([^'"`]*)['"`]/g)].map((l) => l[1]).join(' ')).split(/\s+/));
}

const files = [SRC, join(SRC, '..', '..', 'shared', 'src')].flatMap((root) =>
  (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => join(root, f)));

describe('старые классы кабинета — на ds-*', () => {
  it('ни один className не несёт старый класс', () => {
    expect(files.length).toBeGreaterThan(100);
    const bad = files.flatMap((f) => classTokens(readFileSync(f, 'utf8')).filter((c) => LEGACY.includes(c)).map((c) => `${f.slice(SRC.length - 10)}: ${c}`));
    expect(bad).toEqual([]);
  });

  it('в index.css правил старых классов нет', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const bad = LEGACY.filter((c) => new RegExp(`\\.${c}(?![\\w-])[^{}]*\\{`).test(css));
    expect(bad).toEqual([]);
  });

  it('контрольный образец: разбор className видит строку и литералы выражения', () => {
    expect(classTokens('<b className="btn btn-primary" />')).toContain('btn-primary');
    expect(classTokens("<b className={on ? 'chip chip-success' : 'ds-badge'} />")).toContain('chip-success');
    expect(classTokens('<b className="ds-btn ds-btn--secondary" />').some((c) => LEGACY.includes(c))).toBe(false);
  });
});
