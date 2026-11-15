// @vitest-environment node
// Сверка силуэта «Практик» с разделом (правило №4, образец — diarySkeleton.test.ts): силуэт
// (client-practice-skeleton.css) повторяет сетки раздела своими контейнерами — квадраты (client-practice.css,
// контейнер cp-here), бенто библиотеки (cp-lib) и герой дыхания (breathing.css, qb). Порог или колонки
// разошлись — на ширинах между порогами силуэт рисует другую сетку, и загрузка прыгает.
import { describe, it, expect } from 'vitest';
import { readCss, isPhone, type Rule } from './cssRules.test-helpers';

const page = [...readCss('client-practice.css'), ...readCss('breathing.css')];
const skel = readCss('client-practice-skeleton.css');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const cols = (body: string) => norm(body.match(/(?:^|[;\s])grid-template-columns:\s*([^;]+)/)?.[1] ?? '');
/** Колонки селектора по контекстам; имя контейнера снято — у силуэта свои контейнеры, порог общий. */
const grid = (rules: Rule[], sel: string) => rules
  .filter((r) => r.selectors.includes(sel) && cols(r.body))
  .map((r) => ({ at: norm(r.media).replace(/^@container [\w-]+ /, '@container '), cols: cols(r.body) }));

describe('силуэт «Практик» = раздел: пороги контейнеров и колонки', () => {
  it.each([
    ['квадраты', '.cp-squares--3', '.cpk-squares'],
    ['бенто библиотеки', '.cp-lib', '.cpk-lib'],
    ['герой дыхания', '.qb-in', '.cpk-hero-in'],
  ])('%s: те же колонки на базе и за порогом контейнера', (_name, real, mine) => {
    const want = grid(page, real);
    expect(want.filter((g) => g.at.startsWith('@container'))).toHaveLength(1);
    expect(grid(skel.filter((r) => !r.media.startsWith('@media')), mine)).toEqual(want);
  });

  it('телефон: сцена героя 124px рядом с заголовком и два квадрата — как у .cp-page--phone', () => {
    const phone = skel.filter((r) => isPhone(r.media));
    expect(grid(phone, '.cpk-hero-in').map((g) => g.cols)).toEqual(grid(page, '.cp-page--phone .qb-in').map((g) => g.cols));
    expect(grid(phone, '.cpk-squares').map((g) => g.cols)).toEqual(grid(page, '.cp-squares').map((g) => g.cols));
  });
});
