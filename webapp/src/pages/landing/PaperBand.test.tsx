// @vitest-environment jsdom
// Полоса цветной бумаги (PaperBand): оттенок уходит в --h, у полосы два края — верхний и
// перевёрнутый нижний, каждый в два слоя (лист и лист глубже под ним). Нижний лист обязан
// выглядывать из-под верхнего по всей ширине: если ломаные пересекутся, край «прорвётся».
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PaperBand } from './PaperBand';
import { BAND_HUE } from './productContent';

afterEach(() => cleanup());

/** Ломаная края из d пути: точки после `V…` до `V24 Z`. */
function edge(d: string): [number, number][] {
  const start = Number(d.match(/^M0 24 V(\d+)/)?.[1]);
  const pts: [number, number][] = [[0, start]];
  for (const m of d.matchAll(/L(\d+) (\d+)/g)) pts.push([Number(m[1]), Number(m[2])]);
  return pts;
}
const yAt = (pts: [number, number][], x: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return NaN;
};

describe('PaperBand', () => {
  it('секция с id и оттенком этой секции (BAND_HUE), два края по два слоя, нижний перевёрнут', () => {
    const { container } = render(<PaperBand id="how"><p>текст</p></PaperBand>);
    const band = container.querySelector('section#how.pl2-band') as HTMLElement;
    expect(band.style.getPropertyValue('--h')).toBe(String(BAND_HUE.how));
    const edges = band.querySelectorAll('svg.pl2-edge');
    expect(edges).toHaveLength(2);
    expect(edges[1].classList.contains('pl2-edge--bottom')).toBe(true);
    for (const e of edges) {
      expect(e.getAttribute('aria-hidden')).toBe('true');
      expect(e.querySelectorAll('.pl2-edge-under, .pl2-edge-top')).toHaveLength(2);
    }
    expect(band.textContent).toBe('текст');
    expect(band.classList.contains('pl2-band--calm')).toBe(false);
  });

  it('calm — бумага на тон спокойнее классом, а не селектором по id секции', () => {
    const { container } = render(<PaperBand id="app" calm>x</PaperBand>);
    expect(container.querySelector('section#app')?.classList.contains('pl2-band--calm')).toBe(true);
  });

  it('нижний лист выглядывает из-под верхнего по всей ширине края, неравномерно, со своим срезом', () => {
    const { container } = render(<PaperBand id="faq">x</PaperBand>);
    const under = edge(container.querySelector('.pl2-edge-under')!.getAttribute('d')!);
    const top = edge(container.querySelector('.pl2-edge-top')!.getAttribute('d')!);
    expect(under.at(-1)?.[0]).toBe(1200);
    expect(top.at(-1)?.[0]).toBe(1200);
    const gaps: number[] = [];
    for (let x = 0; x <= 1200; x += 5) gaps.push(yAt(top, x) - yAt(under, x));
    gaps.forEach((g, i) => expect(g, `x=${i * 5}`).toBeGreaterThanOrEqual(3));
    gaps.forEach((g, i) => expect(g, `x=${i * 5}`).toBeLessThanOrEqual(8));
    // не обводка: зазор меняется вдоль края, изломы нижнего — не под изломами верхнего
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThanOrEqual(4);
    const topX = new Set(top.slice(1, -1).map(([x]) => x));
    expect(under.slice(1, -1).filter(([x]) => topX.has(x))).toEqual([]);
  });
});
