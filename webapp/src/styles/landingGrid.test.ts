// @vitest-environment node
// Сетки продуктового лендинга без дыр (ревью 2026-11-08): на 601–900 три карточки
// «Приложения» и три статьи в двух колонках давали ряд 2+1 с пустой половиной справа, — та
// же дыра, которую в бенто «Возможностей» закрыли (сверка бенто — productContent.test.tsx).
// CSS в jsdom не исполняется, поэтому пинаем правила исходника (приём safeTop.test.ts):
// последняя нечётная статья растянута на строку, карточки установки — одной колонкой.
// Живая сверка всех ширин — обход скриншотов (ряд заполнен на всю ширину контейнера).
// Второй блок — заголовки плиток «Возможностей» и «Доверия»: самое длинное слово целиком
// в своей колонке (ревью 2026-11-08: «зашифрованы» на 320 выходило за плитку и край экрана).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOME_FEATURES, HOME_TRUST } from '../../../src/articles/home-landing.content';

const load = (file: string) => readFileSync(join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const css = load('product-landing.css');
const journal = load('product-landing-journal.css');

/** Тело блока `@media <query> { … }` (первого с таким условием). */
function mediaBody(query: string, src = css): string {
  const start = src.indexOf(`@media ${query}`);
  if (start < 0) return '';
  let i = src.indexOf('{', start) + 1;
  const from = i;
  for (let depth = 1; depth > 0 && i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
  }
  return src.slice(from, i - 1);
}

/** Объявления правила с точным селектором внутри блока. */
function rule(block: string, selector: string): string {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(block); m; m = re.exec(block)) {
    if (m[1].split(',').map((s) => s.trim()).includes(selector)) return m[2];
  }
  return '';
}

describe('лендинг: сетка из трёх карточек на 601–900 без ряда 2+1', () => {
  const tablet = mediaBody('(min-width: 601px) and (max-width: 900px)');

  it('две колонки, последняя нечётная статья — во всю строку', () => {
    expect(rule(tablet, '.pl2-3')).toMatch(/grid-template-columns:\s*1fr 1fr/);
    expect(rule(tablet, '.pl2-3 > .pl2-article:last-child:nth-child(odd)')).toMatch(/grid-column:\s*1 \/ -1/);
  });

  it('карточки установки — одной колонкой (сильнее общего правила двух колонок)', () => {
    expect(rule(tablet, '.pl2-3.pl2-3--above-actions')).toMatch(/grid-template-columns:\s*1fr;/);
  });

  it('контрольный образец: без правила растяжки ряд 2+1 правда остаётся (на компьютере три колонки)', () => {
    expect(rule(css, '.pl2-3')).toMatch(/grid-template-columns:\s*repeat\(3, 1fr\)/);
    expect(rule(tablet, '.pl2-3 > .pl2-article:last-child')).toBe('');
  });
});

/** Значение свойства в объявлениях правила ('' — нет). */
const decl = (body: string, prop: string) => body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))?.[1].trim() ?? '';
/** N-е число значения в px: `px('20px 18px 22px', 1)` → 18. */
const px = (v: string, n = 0) => parseFloat(v.split(/\s+/)[n]);

// Ширина буквы Instrument Serif: замер в Chromium — «зашифрованы» 167px при 23px (0.66em на
// букву, самая широкая из заголовков плиток); в модели — с запасом.
const EM_PER_CHAR = 0.68;
const LONGEST = Math.max(...[...HOME_FEATURES, ...HOME_TRUST].flatMap((t) => t.title.split(/\s+/)).map((w) => [...w].length));
const wordPx = (fontPx: number) => LONGEST * EM_PER_CHAR * fontPx;

/** Телефон: колонка заголовка = экран − поля страницы − поля плитки − колонка знака − зазор. */
function phoneTitle(vw: number, narrow: boolean) {
  const base = mediaBody('(max-width: 640px)', journal);
  const small = narrow ? mediaBody('(max-width: 374px)', journal) : '';
  const pick = (sel: string, prop: string) => decl(rule(small, sel), prop) || decl(rule(base, sel), prop);
  const gutter = px(decl(rule(mediaBody('(max-width: 640px)'), '.pl2-sec'), 'padding'), 1);
  const column = vw - 2 * gutter - 2 * px(pick('.pl2-tile', 'padding'), 1)
    - px(pick('.pl2-tile', 'grid-template-columns')) - px(pick('.pl2-tile', 'column-gap'));
  return { column, font: px(pick('.pl2-tile-title', 'font-size')) };
}

describe('лендинг: самое длинное слово заголовка плитки — целиком в своей колонке', () => {
  it('в заголовках есть слово из 11 букв («зашифрованы», «Диагностика») — модель считает по нему', () => {
    expect(LONGEST).toBeGreaterThanOrEqual(11);
  });

  it('телефон 320 (свои колонка и шрифт до 374px) и 375 (общие до 640px)', () => {
    for (const [vw, narrow] of [[320, true], [375, false]] as const) {
      const { column, font } = phoneTitle(vw, narrow);
      expect(wordPx(font), `${vw}px: слово ${wordPx(font).toFixed(0)}px в колонке ${column}px`).toBeLessThanOrEqual(column);
    }
  });

  it('доверие на 641: три плитки в ряд, заголовок по clamp от ширины экрана', () => {
    const tablet = mediaBody('(min-width: 641px) and (max-width: 900px)', journal);
    const [, lo, vwk, hi] = decl(rule(tablet, '.pl2-trust .pl2-tile-title'), 'font-size').match(/clamp\(([\d.]+)px,\s*([\d.]+)vw,\s*([\d.]+)px\)/) ?? [];
    const font = Math.min(Number(hi), Math.max(Number(lo), (641 * Number(vwk)) / 100));
    const tile = (641 - 2 * px(decl(rule(css, '.pl2-sec'), 'padding'), 1) - 2 * px(decl(rule(journal, '.pl2-trust'), 'gap'))) / 3;
    const column = tile - 2 * px(decl(rule(tablet, '.pl2-trust .pl2-tile'), 'padding'), 1);
    expect(wordPx(font)).toBeLessThanOrEqual(column);
  });

  it('контрольный образец: прежние 104px и 23px на 320, 22px в доверии на 641 — слово не помещается', () => {
    expect(wordPx(23)).toBeGreaterThan(320 - 2 * 16 - 2 * 18 - 104 - 16);
    expect(wordPx(22)).toBeGreaterThan((641 - 48 - 36) / 3 - 36);
  });
});
