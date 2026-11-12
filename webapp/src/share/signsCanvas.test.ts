// @vitest-environment jsdom
// Сверка знаков canvas шаринга (shared/src/share/kit/signs.ts) с SVG-мотивами сайта
// (правило №4): каждый ключ таблицы кита рендерится через <SignArt> и сравнивается по
// фигурам — тег, геометрия, поворот, цвет (имя бумаги PAPER). Правка мотива на сайте без
// правки canvas-таблицы краснеет здесь. Плюс: имена бумаги кита = PAPER, палитра данных
// потребностей кита = NEED_DATA_PAPER.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SignArt } from '../components/art/SignArt';
import { PAPER, NEED_DATA_PAPER } from '../components/art/paper';
import { CANVAS_SIGNS, CANVAS_SIGN_KEYS, type SignPrim } from '../../../shared/src/share/kit/signs';
import { NEED_DATA_VARS, PAPER_VARS } from '../../../shared/src/share/kit/ink';
import { countedDrawing } from '../../../shared/src/share/kit/countedSigns';

const NAME_BY_PAPER = new Map<string, string>(Object.entries(PAPER).map(([k, v]) => [v, k]));
NAME_BY_PAPER.set('var(--surface)', 'surface');

const num = (el: Element, a: string) => Number(el.getAttribute(a));
const paint = (v: string | null) => (v == null || v === 'none' ? undefined : NAME_BY_PAPER.get(v) ?? `?${v}`);
const rotOf = (t: string | null): [number, number, number] | undefined => {
  const m = t && /rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/.exec(t);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
};

/** Фигуры SVG в форме примитивов кита; поворот группы <g> переходит на фигуры внутри. */
function svgPrims(key: string, count?: number): { view: number[]; prims: Record<string, unknown>[] } {
  const html = renderToStaticMarkup(createElement(SignArt, { sign: key as never, size: 'row', count }));
  const svg = new DOMParser().parseFromString(html, 'image/svg+xml').documentElement;
  const view = (svg.getAttribute('viewBox') ?? '').split(' ').slice(2).map(Number);
  const prims: Record<string, unknown>[] = [];
  for (const el of Array.from(svg.querySelectorAll('rect, circle, ellipse, path'))) {
    const rot = rotOf(el.getAttribute('transform')) ?? rotOf(el.parentElement?.getAttribute('transform') ?? null);
    const base = {
      fill: paint(el.getAttribute('fill')),
      alpha: el.getAttribute('fill-opacity') && num(el, 'fill-opacity') !== 1 ? num(el, 'fill-opacity') : undefined,
      rot: rot && rot[0] !== 0 ? rot : undefined,
    };
    const stroke = { stroke: paint(el.getAttribute('stroke')), sw: el.getAttribute('stroke-width') ? num(el, 'stroke-width') : undefined };
    if (el.tagName === 'rect')
      prims.push({ t: 'rect', x: num(el, 'x'), y: num(el, 'y'), w: num(el, 'width'), h: num(el, 'height'), rx: num(el, 'rx'), ...base, ...stroke });
    else if (el.tagName === 'circle') prims.push({ t: 'circle', cx: num(el, 'cx'), cy: num(el, 'cy'), r: num(el, 'r'), ...base });
    else if (el.tagName === 'ellipse')
      prims.push({ t: 'ellipse', cx: num(el, 'cx'), cy: num(el, 'cy'), rx: num(el, 'rx'), ry: num(el, 'ry'), ...base });
    else prims.push({ t: 'path', d: el.getAttribute('d'), ...base, ...stroke });
  }
  return { view, prims };
}

/** Примитив кита в той же форме: без join (линия соединения — деталь рисования). */
function kitPrim(p: SignPrim): Record<string, unknown> {
  const { join: _join, rot, ...rest } = p as SignPrim & { join?: string };
  void _join;
  const out: Record<string, unknown> = { stroke: undefined, sw: undefined, alpha: undefined, fill: undefined, ...rest };
  out.rot = rot && rot[0] !== 0 ? [...rot] : undefined;
  if (p.t === 'circle' || p.t === 'ellipse') {
    delete out.stroke;
    delete out.sw;
  }
  return out;
}

describe('знаки canvas = SVG-мотивы сайта', () => {
  it.each(CANVAS_SIGN_KEYS)('%s', (key) => {
    const svg = svgPrims(key);
    const kit = CANVAS_SIGNS[key];
    expect(svg.view).toEqual([...kit.view]);
    const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    expect(svg.prims.map(strip)).toEqual(kit.prims.map((p) => strip(kitPrim(p))));
  });

  it.each([['strokes', 2], ['strokes', 3], ['strokes', 4], ['strokes', 7], ['sheets', 2], ['sheets', 4], ['pebbles', 0], ['pebbles', 1]] as const)(
    'вариант по счёту %s × %i (значки достижений, благодарность) = countedDrawing',
    (key, n) => {
      const svg = svgPrims(key, n);
      const kit = countedDrawing(key, n)!;
      expect(svg.view).toEqual([...kit.view]);
      const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
      expect(svg.prims.map(strip)).toEqual(kit.prims.map((p) => strip(kitPrim(p))));
    },
  );

  it('покрыты знаки карточек шаринга (b23a, b23b: шаги пути, значки, приглашения)', () => {
    for (const k of ['strokes', 'pebbles', 'breath', 'sheets', 'layers', 'cluster', 'leaf', 'check', 'heart', 'wheel', 'talk', 'child_care', 'scales', 'haven',
      'need_attachment', 'need_autonomy', 'need_expression', 'need_play', 'need_limits'])
      expect(CANVAS_SIGN_KEYS).toContain(k);
  });
});

describe('бумага и палитра данных кита = webapp', () => {
  it.each(Object.entries(PAPER_VARS))('PAPER.%s = var(%s)', (name, v) => {
    expect(name === 'surface' ? 'var(--surface)' : PAPER[name as keyof typeof PAPER]).toBe(`var(${v})`);
  });

  it('NEED_DATA_PAPER — те же переменные, в том же порядке', () => {
    expect([...NEED_DATA_PAPER]).toEqual(NEED_DATA_VARS.map((v) => `var(${v})`));
  });
});
