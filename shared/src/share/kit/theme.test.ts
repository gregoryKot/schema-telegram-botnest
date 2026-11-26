/// <reference types="node" />
// Тема и чернила карточки (правило №4): карточка всегда светлая, чернила — значения светлой
// темы сайта. Таблица INK_VARS сверяется с `webapp/src/index.css` (блок светлой темы, var()
// разворачивается), бумага знаков — с PAPER (sage — смесь мха и фона), бумага листа — с
// формулой oklch (сверка с toneHex, которую уже держит entityHue.test).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCardTheme, SERIF } from './theme';
import {
  INK,
  INK_VARS,
  PAPER_INK,
  inkOf,
  needDataInk,
  needTextInk,
} from './ink';
import { paperHex, layerHex, hueFromColor } from './paperFrame';
import { oklchHex, toneHex } from '../../theme/entityHue';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/** Переменные первого блока светлой темы index.css с развёрнутыми var(). */
function lightTokens(): Record<string, string> {
  const css = readFileSync(join(REPO_ROOT, 'webapp/src/index.css'), 'utf8');
  const start = css.indexOf(':root, html[data-theme="light"], .light-lock {');
  expect(start).toBeGreaterThan(-1);
  const block = css
    .slice(start, css.indexOf('\n}', start))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const raw: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    raw[m[1]] = m[2].trim();
  const resolve = (v: string, depth = 0): string => {
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    return m && depth < 5 ? resolve(raw[m[1]] ?? v, depth + 1) : v;
  };
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, resolve(v).toLowerCase()]),
  );
}

const mix = (a: string, b: string, k: number) => {
  const ch = (h: string, i: number) =>
    parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    '#' +
    [0, 1, 2]
      .map((i) =>
        Math.round(ch(a, i) * k + ch(b, i) * (1 - k))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
};

describe('чернила карточки = светлая тема сайта', () => {
  const tokens = lightTokens();
  it.each(Object.entries(INK_VARS))('%s', (name, value) => {
    expect(tokens[name]).toBe(value);
  });

  it('sage знаков — --c-moss 55 % на --bg, как PAPER.sage', () => {
    expect(PAPER_INK.sage).toBe(mix(tokens['--c-moss'], tokens['--bg'], 0.55));
  });
});

describe('resolveCardTheme', () => {
  it('одна светлая тема на любую тему приложения: фон — бумага страницы, заголовки — Literata', () => {
    const th = resolveCardTheme();
    expect(th.bg).toBe(INK.page);
    expect(th.isLight).toBe(true);
    expect(SERIF.startsWith("'Literata'")).toBe(true);
    expect(th.color('var(--accent-red)')).toBe(INK_VARS['--accent-red']);
    expect(th.color('#123456')).toBe('#123456');
  });

  it('незнакомая переменная — чернила подписи, а не серый выдуманный', () => {
    expect(inkOf('var(--nope)')).toBe(INK.sub);
  });
});

describe('бумага листа', () => {
  it('oklchHex при L .58 C .12 — тот же цвет, что toneHex (одна формула)', () => {
    for (const h of [28, 70, 135, 240, 310])
      expect(oklchHex(0.58, 0.12, h)).toBe(toneHex(h));
  });

  it('лист светлее второго листа под ним и одного оттенка', () => {
    const lum = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) +
      parseInt(hex.slice(3, 5), 16) +
      parseInt(hex.slice(5, 7), 16);
    for (const h of [25, 70, 195, 310])
      expect(lum(paperHex(h))).toBeGreaterThan(lum(layerHex(h)));
    expect(hueFromColor(paperHex(195))).toBe(195);
    expect(hueFromColor(undefined)).toBe(240);
  });
});

describe('палитра данных потребностей', () => {
  it('цвет данных и цвет числа — по id, неизвестная — без выдуманного цвета', () => {
    expect(needDataInk('attachment')).toBe(INK_VARS['--c-clay']);
    expect(needDataInk('autonomy')).toBe(INK_VARS['--c-amber-strong']);
    expect(needTextInk('expression')).toBe(INK_VARS['--accent-blue']);
    expect(needDataInk('safety')).toBeNull();
    expect(needTextInk('safety')).toBe(INK.sub);
  });
});
