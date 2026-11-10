// @vitest-environment node
// Сверка силуэта ленты «Записей» с лентой (правило №4, ревью g3): силуэт (client-diary-skeleton.css) строил
// раскладку по окну, а лента (client-diary.css) — по своей странице (container cd-page). На 768 с меню силуэт
// рисовал колонку даты, а лента приходила столбиком; на 1280 силуэт тянул карточки до края, а справа у ленты
// вставала «Эта неделя». Пороги и колонки обязаны совпадать — каждая загрузка иначе прыгает.
import { describe, it, expect } from 'vitest';
import { readCss, type Rule } from './cssRules.test-helpers';
import { DESKTOP_MEDIA } from '../utils/phoneLayout';

const feed = readCss('client-diary.css');
const skel = readCss('client-diary-skeleton.css');
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const decl = (body: string, prop: string) => body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+)`))?.[1].trim();
/** Медиа-контекст и колонки сетки селектора там, где сетка включается. */
const gridAt = (rules: Rule[], sel: string) =>
  rules.filter((r) => r.selectors.includes(sel) && decl(r.body, 'grid-template-columns'))
    .map((r) => ({ media: norm(r.media), cols: norm(decl(r.body, 'grid-template-columns') ?? '') }));
const ownBody = (rules: Rule[], sel: string) =>
  rules.filter((r) => r.media === '' && r.selectors.includes(sel)).map((r) => r.body).join(';');

describe('силуэт ленты «Записей» = лента: контейнер, пороги, колонки', () => {
  it('силуэт раздела — свой контейнер cd-page, как у страницы ленты', () => {
    expect(decl(ownBody(feed, '.cd-page'), 'container')).toBe('cd-page / inline-size');
    expect(decl(ownBody(skel, '.cdk-page'), 'container')).toBe('cd-page / inline-size');
  });

  it('колонка даты слева — тот же @container и те же колонки, что у .cd-day', () => {
    const real = gridAt(feed, '.cd-day');
    expect(real).toHaveLength(1);
    expect(real[0].media).toMatch(/^@container cd-page \(min-width: \d+px\)$/);
    expect(gridAt(skel, '.cdk-day')).toEqual(real);
  });

  it('«Эта неделя» справа — тот же @container и те же колонки, что у .cd-feed--week; на узком места нет', () => {
    const real = gridAt(feed, '.cd-feed--week');
    expect(real).toHaveLength(1);
    expect(gridAt(skel, '.cdk-feed').filter((g) => g.media !== '')).toEqual(real);
    expect(decl(ownBody(skel, '.cdk-week'), 'display')).toBe('none');
    const shown = skel.filter((r) => r.selectors.includes('.cdk-week') && decl(r.body, 'display') === 'block');
    expect(shown.map((r) => norm(r.media))).toEqual([real[0].media]);
  });

  it('раскладка дней силуэта не зависит от окна: ни одного правила дня или ленты под @media', () => {
    const daySel = /^\.cdk-(day|head|items|feed|week)\b/;
    expect(skel.filter((r) => r.media.startsWith('@media') && r.selectors.some((s) => daySel.test(s)))).toEqual([]);
  });

  it('шапка силуэта — по окну, как шапка ленты (.cd-head переключается DESKTOP_MEDIA)', () => {
    const top = skel.filter((r) => r.selectors.includes('.cdk-top') && /flex-direction:\s*row/.test(r.body));
    expect(top.map((r) => norm(r.media))).toEqual([`@media ${DESKTOP_MEDIA}`]);
    const head = feed.filter((r) => r.selectors.includes('.pp-block.cd-head') && /flex-direction:\s*row/.test(r.body));
    expect(head.map((r) => norm(r.media))).toEqual([`@media ${DESKTOP_MEDIA}`]);
  });
});
