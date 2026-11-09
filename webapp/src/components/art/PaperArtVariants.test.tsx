// @vitest-environment jsdom
// Варианты мотивов (PaperArt.tsx, GuideSignsTechniques.tsx) и новые знаки (AppSigns.tsx):
// данные рисуются только реальные — оценка задаёт высоту полоски, счёт — число камешков,
// пустое место — пустой тон бумаги, а не выдуманная фигура; без нового пропа мотив тот же,
// что раньше (лендинг и кабинет не меняются).
import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Strokes, Pebbles } from './PaperArt';
import { Scales } from './GuideSignsTechniques';
import { Grounded, Pause, Haven, Join } from './AppSigns';
import { Check } from './PaperArtSigns';
import { SignArt } from './SignArt';
import { NEED_DATA_PAPER, PAPER, pebblesLaid } from './paper';
import { NEED_ORDER } from '../../../../shared/src/needs/types';

const rects = (ui: ReactElement) => [...render(ui).container.querySelectorAll('rect')];
const h = (r: Element) => Number(r.getAttribute('height'));

describe('Strokes: по оценкам, ровно, по умолчанию', () => {
  it('без пропов — пять плотных полосок с наклоном, как было', () => {
    const list = rects(<Strokes />);
    expect(list).toHaveLength(5);
    expect(list.every((r) => h(r) === 84 && r.getAttribute('transform')?.startsWith('rotate('))).toBe(true);
  });

  it('values: выше оценка — выше полоска, низ у всех на одной линии; без оценки — пустой тон бумаги', () => {
    const list = rects(<Strokes values={[10, 2, null, 6, 0]} />);
    expect(list.map(h)).toEqual([84, 30, 72, 57, 16]);
    for (const r of list) expect(Number(r.getAttribute('y')) + h(r)).toBe(92);
    expect(list[2].getAttribute('data-rated')).toBe('no');
    expect(list[2].getAttribute('fill')).toBe(PAPER.hollow);
    expect(list[0].getAttribute('data-value')).toBe('10');
  });

  it('values: полоска оценённой потребности — цвет данных своей потребности (порядок NEED_ORDER)', () => {
    const list = rects(<Strokes values={[1, 2, 3, 4, 5]} />);
    expect(list.map((r) => r.getAttribute('fill'))).toEqual([...NEED_DATA_PAPER]);
    expect(NEED_ORDER).toEqual(['attachment', 'autonomy', 'expression', 'play', 'limits']);
  });

  it('values за пределами шкалы не вылезают из поля', () => {
    expect(rects(<Strokes values={[14, -3]} />).map(h)).toEqual([84, 16]);
  });

  it('even — ровный день: одна высота, без наклона', () => {
    const list = rects(<Strokes even />);
    expect(new Set(list.map(h)).size).toBe(1);
    expect(list.every((r) => r.getAttribute('transform') === null)).toBe(true);
  });
});

describe('Pebbles filled', () => {
  it('легло столько, сколько записано; остальные — пустой тон', () => {
    const els = [...render(<Pebbles filled={1} />).container.querySelectorAll('ellipse')];
    expect(els.map((e) => e.getAttribute('data-laid'))).toEqual(['yes', 'no', 'no']);
    expect(els[1].getAttribute('fill')).toBe(PAPER.hollow);
  });

  it('без filled — все три, без пометок', () => {
    const els = [...render(<Pebbles />).container.querySelectorAll('ellipse')];
    expect(els.every((e) => e.getAttribute('fill') !== PAPER.hollow && !e.hasAttribute('data-laid'))).toBe(true);
  });

  // Ревью g3: пустой камешек — гнездо своего цвета (правило [data-laid="no"] в paper.css берёт `color`),
  // а не серый призрак; число прижимается одной функцией pebblesLaid.
  it('гнездо несёт цвет своего камешка; filled вне 0…3 прижат', () => {
    const els = [...render(<Pebbles filled={0} />).container.querySelectorAll('ellipse')];
    expect(els.map((e) => e.getAttribute('color'))).toEqual([PAPER.moss, PAPER.brown, PAPER.clay]);
    expect([...render(<Pebbles filled={7} />).container.querySelectorAll('ellipse[data-laid="yes"]')]).toHaveLength(3);
    expect([...render(<Pebbles filled={-2} />).container.querySelectorAll('ellipse[data-laid="yes"]')]).toHaveLength(0);
  });
});

describe('pebblesLaid', () => {
  it.each([[0, 0], [1, 1], [2.9, 2], [3, 3], [12, 3], [-1, 0], [Number.NaN, 0], [Infinity, 3]])('%s → %s', (n, want) => {
    expect(pebblesLaid(n)).toBe(want);
  });
});

describe('Scales left/right', () => {
  const look = (ui: ReactElement) => {
    const { container } = render(ui);
    const g = container.querySelector('g') as SVGGElement;
    return {
      tilt: Number(/rotate\((-?[\d.]+)/.exec(g.getAttribute('transform') ?? '')?.[1]),
      left: [...g.querySelectorAll(`ellipse[fill="${PAPER.moss}"]`)].length,
      right: [...g.querySelectorAll(`ellipse[fill="${PAPER.clay}"]`)].length,
    };
  };

  it('счёт → камешки на чашах, перекладина клонится к тяжёлой стороне', () => {
    expect(look(<Scales left={3} right={1} />)).toEqual({ tilt: -6, left: 3, right: 1 });
    expect(look(<Scales left={0} right={2} />)).toMatchObject({ left: 0, right: 2 });
    expect(look(<Scales left={0} right={2} />).tilt).toBeGreaterThan(0);
  });

  it('поровну — равновесие; ноль — пустые чаши; больше пяти — пять камешков', () => {
    expect(look(<Scales left={2} right={2} />).tilt).toBe(0);
    expect(look(<Scales left={0} right={0} />)).toEqual({ tilt: 0, left: 0, right: 0 });
    expect(look(<Scales left={9} right={0} />)).toEqual({ tilt: -9, left: 5, right: 0 });
  });

  it('без счёта — знак техники как был', () => {
    expect(look(<Scales />)).toEqual({ tilt: -7, left: 1, right: 1 });
  });
});

describe('новые знаки: Grounded, Pause, Haven, Join', () => {
  it('Grounded: пять камешков от большого к малому стопкой — нижний на земле, каждый на предыдущем', () => {
    const els = [...render(<Grounded />).container.querySelectorAll('ellipse')];
    expect(els).toHaveLength(5);
    const num = (e: Element, a: string) => Number(e.getAttribute(a));
    const rx = els.map((e) => num(e, 'rx'));
    expect([...rx].sort((a, b) => b - a)).toEqual(rx);
    expect(num(els[0], 'cy') + num(els[0], 'ry')).toBeCloseTo(58);
    for (let i = 1; i < els.length; i++) {
      expect(num(els[i], 'cy') + num(els[i], 'ry')).toBeCloseTo(num(els[i - 1], 'cy') - num(els[i - 1], 'ry'));
    }
    expect(Math.min(...els.map((e) => num(e, 'cy') - num(e, 'ry')))).toBeGreaterThan(0);
  });

  it('Pause: лента и дуга мха — лента упирается в вогнутую сторону дуги и не проходит сквозь неё', () => {
    const [ribbon, arc] = [...render(<Pause />).container.querySelectorAll('path')];
    expect(ribbon.getAttribute('stroke')).toBe(PAPER.clay);
    expect(arc.getAttribute('stroke')).toBe(PAPER.moss);
    const ribbonEnd = Number(/(-?[\d.]+) (-?[\d.]+)$/.exec(ribbon.getAttribute('d')!)![1]);
    // M x y1 A r r 0 0 1 x y2 — дуга выгнута вправо: вершина = x − √(r² − h²) + r, внутренний край — минус полтолщины
    const [, x, y1, r, y2] = /^M([\d.]+) ([\d.]+) A ([\d.]+) [\d.]+ 0 0 1 [\d.]+ ([\d.]+)$/.exec(arc.getAttribute('d')!)!.map(Number);
    const half = (y2 - y1) / 2;
    const innerVertex = x - Math.sqrt(r * r - half * half) + r - Number(arc.getAttribute('stroke-width')) / 2;
    const capEnd = ribbonEnd + Number(ribbon.getAttribute('stroke-width')) / 2;
    expect(capEnd).toBeLessThan(innerVertex);
    expect(innerVertex - capEnd).toBeLessThan(6);
  });

  it('Haven: рамка мха открыта сверху, внутри круг глины и лист', () => {
    const { container } = render(<Haven />);
    const frame = container.querySelector(`path[stroke="${PAPER.moss}"]`) as SVGPathElement;
    expect(frame.getAttribute('d')).not.toMatch(/Z\s*$/i);
    expect(container.querySelector(`circle[fill="${PAPER.clay}"]`)).not.toBeNull();
  });

  it('Join: бледный и полный круг на одной дуге; бледный — сплошным тоном, не прозрачностью', () => {
    const circles = [...render(<Join />).container.querySelectorAll('circle')];
    expect(circles).toHaveLength(2);
    expect(circles.map((c) => c.getAttribute('cy'))).toEqual(['38', '38']);
    expect(circles[0].hasAttribute('fill-opacity')).toBe(false);
    expect(circles[0].getAttribute('fill')).not.toBe(circles[1].getAttribute('fill'));
  });
});

describe('Check: плашка — вариант мотива пропом', () => {
  it('без пропа — шалфейная плашка, как в строках; plate="surface" — бумагой --surface, галочка та же', () => {
    const sage = rects(<Check size="row" />);
    expect(sage).toHaveLength(1);
    expect(sage[0].getAttribute('fill')).toBe(PAPER.sage);
    const surface = render(<Check size="hero" plate="surface" />).container;
    expect(surface.querySelector('rect')!.getAttribute('fill')).toBe('var(--surface)');
    expect(surface.querySelector('path')!.getAttribute('stroke')).toBe(PAPER.moss);
  });

  it('SignArt передаёт plate мотиву; знак без плашки его не читает', () => {
    expect(rects(<SignArt sign="check" plate="surface" />)[0].getAttribute('fill')).toBe('var(--surface)');
    expect(rects(<SignArt sign="check" />)[0].getAttribute('fill')).toBe(PAPER.sage);
    const leaf = render(<SignArt sign="leaf" plate="surface" />).container.innerHTML;
    expect(leaf).toBe(render(<SignArt sign="leaf" />).container.innerHTML);
  });
});
