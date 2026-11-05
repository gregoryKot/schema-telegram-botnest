// @vitest-environment node
// Текст на залитом акценте — токен --on-accent, а не белый литерал. Белый
// темой не меняется: в тёмной теме --accent светлый (#9089e0), и белый на нём
// не читается, а --on-accent там тёмный (shared/src/theme/tokens.css). Свип по
// образцу #516 (--on-accent-red): DESIGN_AUDIT_2026-08, «Что по цвету открыто», п. 1.
// Сверка: ни одно CSS-правило сайта с заливкой ровно var(--accent) не красит
// текст белым литералом.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const files = ['index.css', ...readdirSync(__dirname).filter((f) => f.endsWith('.css')).map((f) => `styles/${f}`)];

/** Правила (селектор → объявления) с заливкой ровно var(--accent) и белым текстом. */
function whiteOnAccent(css: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  while ((m = re.exec(clean))) {
    const body = m[2];
    if (!/background(-color)?:\s*var\(--accent\)/.test(body)) continue;
    if (/(^|;|\s)color:\s*(#fff\b|#ffffff\b|white\b)/i.test(body)) out.push(m[1].trim());
  }
  return out;
}

describe('белый литерал на заливке --accent', () => {
  it.each(files)('%s: текст на акценте — var(--on-accent)', (f) => {
    expect(whiteOnAccent(readFileSync(join(SRC, f), 'utf8'))).toEqual([]);
  });

  it('контрольный образец: сверка видит белый на акценте', () => {
    expect(whiteOnAccent('.x { background: var(--accent); color: #fff; }')).toEqual(['.x']);
    expect(whiteOnAccent('.y { background: var(--accent-hot); color: #fff; }')).toEqual([]);
  });
});
