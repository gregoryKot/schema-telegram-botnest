/// <reference types="node" />
// Сверка пары цвета группы режимов (правило №4): токен tokens.css (DOM) и hex (canvas шаринга) —
// один цвет; у каждого --mode-* светлого блока есть пара, у каждой пары — токен.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODE_GROUP_COLOR } from './modeGroupColor';
import { oklchHex } from './entityHue';

/** --mode-* из блока `:root, [data-theme='light'], .light-lock` в tokens.css. */
function lightModeTokens(): Record<string, string> {
  const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const start = css.search(
    /:root,\s*\[data-theme='light'\],\s*\.light-lock\s*\{/,
  );
  expect(start).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf('\n}', start));
  return Object.fromEntries(
    [...block.matchAll(/(--mode-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

const tokens = lightModeTokens();
const varName = (css: string) => /^var\((--[\w-]+)\)$/.exec(css)?.[1] ?? css;

describe('MODE_GROUP_COLOR: токен ↔ hex', () => {
  it.each(Object.entries(MODE_GROUP_COLOR))(
    '%s: hex для canvas — тот же цвет, что токен в tokens.css',
    (_group, { css, hex }) => {
      const value = tokens[varName(css)] ?? '';
      const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
      expect(m, `${varName(css)}: ${value || 'не объявлен'}`).not.toBeNull();
      expect(oklchHex(Number(m![1]), Number(m![2]), Number(m![3]))).toBe(hex);
    },
  );

  it('токены --mode-* и пары совпадают списком: без токена-сироты и пары без токена', () => {
    const paired = Object.values(MODE_GROUP_COLOR).map((c) => varName(c.css));
    expect(Object.keys(tokens).sort()).toEqual(paired.sort());
  });
});
