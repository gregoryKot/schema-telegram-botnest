// @vitest-environment jsdom
// Текст продуктового лендинга живёт в src/articles/home-landing.content.ts —
// его же сервер вкладывает в #root главной для робота без JS (GEO.md). Здесь:
// у каждого пункта есть вид (сцена или знак и оттенок бумаги), адрес сайта практики в тексте тот
// же, что у трекинга клика, и ссылки внутри текста рисуются правильно.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { STEPS, FEATURES, TRUST, FAQ, BAND_HUE, AUTHOR_HUE } from './productContent';
import { Rich } from './Rich';
import { HowSection } from './HowSection';
import { FeaturesSection } from './FeaturesSection';
import { AUTHOR_SITE } from './practiceLink';
import {
  HOME_AUTHOR_SITE,
  HOME_STEPS,
  HOME_FEATURES,
  HOME_TRUST,
  HOME_FAQ,
} from '../../../../src/articles/home-landing.content';

const trackPublicEvent = vi.fn();
vi.mock('../../api', () => ({
  api: { trackPublicEvent: (...a: unknown[]) => trackPublicEvent(...a) },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('productContent: вид по id поверх общего текста', () => {
  it('каждый пункт текста получил вид, порядок сохранён', () => {
    expect(STEPS.map((s) => s.id)).toEqual(HOME_STEPS.map((s) => s.id));
    expect(FEATURES.map((f) => f.id)).toEqual(HOME_FEATURES.map((f) => f.id));
    expect(TRUST.map((t) => t.id)).toEqual(HOME_TRUST.map((t) => t.id));
    // Вид — картинка языка знаков и оттенок бумаги: у шага крупная сцена (LandingScenes),
    // у возможности и доверия — знак (PaperArt); оттенок — hue oklch, 0…360.
    for (const s of STEPS) expect(typeof s.Scene).toBe('function');
    for (const x of [...FEATURES, ...TRUST]) expect(typeof x.Art).toBe('function');
    for (const x of [...STEPS, ...FEATURES, ...TRUST]) expect(x.hue).toBeGreaterThanOrEqual(0);
    for (const x of [...STEPS, ...FEATURES, ...TRUST]) expect(x.hue).toBeLessThan(360);
    expect(STEPS.map((s) => s.num)).toEqual(['01', '02', '03']);
  });

  it('возможности: сцена только у дневника, остальные — знаки кабинета; соседи не одной бумаги', () => {
    // «Режимы» — сам знак кабинета Cluster (SignScene), не перерисованная сцена: один мотив на сущность
    expect(FEATURES.filter((f) => f.Scene).map((f) => f.id)).toEqual(['diary']);
    for (const f of FEATURES.filter((x) => x.Scene)) expect(typeof f.Scene).toBe('function');
    const hues = FEATURES.map((f) => f.hue);
    expect(new Set(hues).size).toBe(hues.length);
    const stepHues = STEPS.map((s) => s.hue);
    expect(new Set(stepHues).size).toBe(stepHues.length);
    expect(FAQ).toBe(HOME_FAQ);
  });

  // Оттенок пункта (STEP_LOOK, FEATURE_LOOK) красит полоску под номером шага и плитку, а лист и
  // тень сцены берут --h со своего svg: два места обязаны совпадать (правило №4).
  it('сцена рисуется в оттенке своего пункта: лист сцены, плитка и полоска номера одной бумаги', () => {
    const { container } = render(<><HowSection /><FeaturesSection /></>);
    const items = [...container.querySelectorAll<HTMLElement>('.pl2-spread, .pl2-tile')].filter((el) => el.querySelector('svg.scn'));
    expect(items).toHaveLength(STEPS.length + FEATURES.filter((f) => f.Scene).length);
    for (const el of items) {
      const svg = el.querySelector('svg.scn') as SVGElement;
      expect(svg.style.getPropertyValue('--h'), el.className).toBe(el.style.getPropertyValue('--h'));
    }
  });

  // Бенто «Возможностей» раскладывается подряд: на 4 колонках (компьютер) и на 2 (планшет)
  // каждый ряд обязан заполниться целиком — иначе в сетке дыра (судьи 2026-11, вариант C).
  it.each([4, 2])('возможности: на %i колонках ряды без дыр (широкая плитка — две колонки)', (cols) => {
    const rows: number[] = [];
    let used = 0;
    for (const f of FEATURES) {
      const span = f.wide ? 2 : 1;
      if (used + span > cols) { rows.push(used); used = 0; }
      used += span;
    }
    rows.push(used);
    expect(rows.every((r) => r === cols)).toBe(true);
    if (cols === 4) expect(FEATURES.map((f) => (f.wide ? 2 : 1))).toEqual([2, 1, 1, 1, 1, 2]);
  });

  // Ритм оттенков (ревью 2026-11-08): «Кабинет терапевта» на небе сливался с полосой
  // «Приложения» того же неба, «Режимы» (25) и «Практики» (45) подряд на телефоне читались одним
  // розовым. Соседи — разной бумаги: дальше 45° по кругу оттенков.
  const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  /** Раскладка бенто по колонкам: [ряд, первая колонка, последняя колонка] на плитку. */
  const place = (cols: number) => {
    let row = 0, col = 0;
    return FEATURES.map((f) => {
      const span = cols === 1 ? 1 : f.wide ? 2 : 1;
      if (col + span > cols) { row++; col = 0; }
      const at = { f, row, from: col, to: col + span - 1 };
      col += span;
      return at;
    });
  };
  it.each([4, 2, 1])('возможности на %i колонках: соседи по ряду и столбцу разной бумаги, нижний ряд — не бумаги полосы «Приложения»', (cols) => {
    const cells = place(cols);
    const lastRow = Math.max(...cells.map((c) => c.row));
    for (const a of cells) {
      for (const b of cells) {
        const sideBySide = a.row === b.row && b.from === a.to + 1;
        const stacked = b.row === a.row + 1 && b.from <= a.to && a.from <= b.to;
        if (sideBySide || stacked) expect(apart(a.f.hue, b.f.hue), `${a.f.id} — ${b.f.id}`).toBeGreaterThanOrEqual(45);
      }
      if (a.row === lastRow) expect(apart(a.f.hue, BAND_HUE.app), `${a.f.id} над полосой`).toBeGreaterThanOrEqual(45);
    }
  });

  it('доверие: плитки разной бумаги, не бумаги полосы «Приложения» над ними и листа автора под ними', () => {
    const hues = TRUST.map((t) => t.hue);
    for (let i = 0; i + 1 < hues.length; i++) expect(apart(hues[i], hues[i + 1])).toBeGreaterThanOrEqual(45);
    for (const h of hues) {
      expect(apart(h, BAND_HUE.app)).toBeGreaterThanOrEqual(45);
      expect(apart(h, AUTHOR_HUE)).toBeGreaterThanOrEqual(45);
    }
  });

  it('сайт практики в тексте = адрес, клик по которому считается', () => {
    expect(HOME_AUTHOR_SITE).toBe(AUTHOR_SITE);
    const links = HOME_FAQ.flatMap((f) => f.a).filter((p) => typeof p !== 'string');
    expect(links.map((l) => l.href)).toContain(AUTHOR_SITE);
  });
});

describe('Rich: текст со ссылками', () => {
  const parts = [
    'можно ',
    { text: 'поддержать', href: '/donate' },
    ' и ',
    { text: 'сайте практики', href: AUTHOR_SITE },
    '.',
  ];

  it('строки — текстом, внутренняя ссылка — в той же вкладке', () => {
    const { container } = render(<p><Rich parts={parts} /></p>);
    // Строки — через glue (typo.ts): после «и» пробел неразрывный, слова те же.
    expect(container.textContent).toBe('можно поддержать и\u00a0сайте практики.');
    const donate = screen.getByText('поддержать') as HTMLAnchorElement;
    expect(donate.getAttribute('href')).toBe('/donate');
    expect(donate.getAttribute('target')).toBeNull();
  });

  it('сайт практики — новая вкладка; клик считается с местом текста', () => {
    render(<p><Rich parts={parts} place="faq" /></p>);
    const site = screen.getByText('сайте практики') as HTMLAnchorElement;
    expect(site.getAttribute('target')).toBe('_blank');
    expect(site.getAttribute('rel')).toBe('noopener noreferrer');
    fireEvent.click(site);
    expect(trackPublicEvent).toHaveBeenCalledWith('practice_link_click', { place: 'faq' });
    fireEvent.click(screen.getByText('поддержать'));
    expect(trackPublicEvent).toHaveBeenCalledTimes(1);
  });

  it('без места клик по сайту практики не считается', () => {
    render(<p><Rich parts={parts} /></p>);
    fireEvent.click(screen.getByText('сайте практики'));
    expect(trackPublicEvent).not.toHaveBeenCalled();
  });
});
