// @vitest-environment jsdom
// Знак «Всё по схеме» — один рисунок в четырёх местах (правило №4): React-компонент (токены),
// favicon.svg и PNG (значения, scripts/generate-pwa-icons.mjs), canvas карточек (значения).
// Тест держит, что они не разъедутся: файл favicon.svg — ровно то, что строит модуль знака,
// значения цветов — светлые токены index.css, компонент красит теми же токенами.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BrandMark } from './BrandMark';
import { PAPER } from './paper';
import { LoginShell } from '../../pages/login/LoginShell';
import { ServicePage } from '../../pages/service/ServicePage';
import {
  ARC, ARC_D, BRAND_HEX, CORE, MARK_VIEW, STRIPE, STRIPE_D, TILE_RX, brandMarkSvg, markFit,
} from '../../../../shared/src/share/kit/brandMark';

afterEach(cleanup);

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
const mark = (root: HTMLElement) => root.querySelector('svg[data-brand-mark]')!;

describe('BrandMark', () => {
  it('полный: плитка, полоска, дуга, круг — цвета токенами, декор скрыт от чтения', () => {
    const svg = mark(render(<BrandMark />).container);
    expect(svg.getAttribute('data-brand-mark')).toBe('full');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('rect')!.getAttribute('rx')).toBe(String(TILE_RX));
    expect(svg.querySelector('rect')!.getAttribute('fill')).toBe('var(--bg)');
    expect(svg.querySelector(`path[d="${STRIPE_D}"]`)!.getAttribute('fill')).toBe(PAPER.sage);
    expect(svg.querySelector(`path[d="${ARC_D}"]`)!.getAttribute('stroke')).toBe(PAPER.moss);
    expect(svg.querySelector('circle')!.getAttribute('fill')).toBe(PAPER.clay);
  });

  it('simple — без полоски фона (16–24 px), размер — из пропа', () => {
    const svg = mark(render(<BrandMark simple size={20} />).container);
    expect(svg.getAttribute('data-brand-mark')).toBe('simple');
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.querySelector(`path[d="${STRIPE_D}"]`)).toBeNull();
    expect(svg.querySelector(`path[d="${ARC_D}"]`)).toBeTruthy();
  });

  it('вход и служебные страницы показывают знак, а не букву «В»', () => {
    for (const ui of [<LoginShell>x</LoginShell>, <ServicePage>x</ServicePage>]) {
      const { container, unmount } = render(ui);
      expect(mark(container)).toBeTruthy();
      expect([...container.querySelectorAll('*')].some((el) => el.textContent === 'В')).toBe(false);
      unmount();
    }
  });
});

describe('favicon.svg и цвета знака — сверка с модулем и токенами', () => {
  it('favicon.svg — ровно простой знак из модуля (перегенерируй скриптом иконок)', () => {
    expect(read('../../../public/favicon.svg')).toBe(brandMarkSvg({ simple: true }));
  });

  it('значения цветов = светлые токены index.css, шалфей = смесь PAPER.sage', () => {
    const css = read('../../index.css');
    const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(css)?.[1]?.toLowerCase();
    expect(BRAND_HEX.paper).toBe(token('bg'));
    expect(BRAND_HEX.moss).toBe(token('c-moss'));
    expect(BRAND_HEX.clay).toBe(token('c-clay'));
    const pct = Number(/var\(--c-moss\) (\d+)%, var\(--bg\)/.exec(PAPER.sage)?.[1]) / 100;
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [m, b] = [rgb(BRAND_HEX.moss), rgb(BRAND_HEX.paper)];
    expect(rgb(BRAND_HEX.sage)).toEqual(m.map((v, i) => Math.round(v * pct + b[i] * (1 - pct))));
  });
});

describe('геометрия знака', () => {
  it('полоска лежит между скруглениями плитки — обрезать её не нужно', () => {
    for (const [x] of STRIPE) {
      expect(x).toBeGreaterThanOrEqual(TILE_RX);
      expect(x).toBeLessThanOrEqual(MARK_VIEW - TILE_RX);
    }
  });

  it('дуга и круг — в безопасной зоне maskable (круг 80 % холста) в обоих вариантах', () => {
    const safe = MARK_VIEW * 0.4;
    for (const simple of [false, true]) {
      const { scale, ox, oy } = markFit(simple);
      const far = (cx: number, cy: number, r: number) =>
        Math.hypot((cx - ox) * scale, (cy - oy) * scale) + r * scale;
      expect(far(ARC.cx, ARC.cy, ARC.r + ARC.width / 2)).toBeLessThanOrEqual(safe);
      expect(far(CORE.cx, CORE.cy, CORE.r)).toBeLessThanOrEqual(safe);
    }
  });
});

describe('BrandMark bare', () => {
  it('без плитки: тот же знак, фона-плашки нет', () => {
    const svg = mark(render(<BrandMark simple bare />).container);
    expect(svg.querySelector('rect')).toBeNull();
    expect(svg.querySelector('circle')).not.toBeNull();
  });
});
