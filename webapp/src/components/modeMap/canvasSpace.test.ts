// Свободное место на холсте (QA 2026-10-26): фигуры из палитры ложились
// случайно друг на друга, «Показать всё» прятало фигуры под подсказками справа.
import { describe, it, expect } from 'vitest';
import { findFreeSpot, findFreeSpots, fitInsets, insideView, NEW_NODE_SIZE, NODE_GAP, type Rect } from './canvasSpace';

const view: Rect = { x: 0, y: 0, w: 1000, h: 600 };
const box = (p: { x: number; y: number }): Rect => ({ ...p, ...NEW_NODE_SIZE });
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('findFreeSpot', () => {
  it('пустой холст — левый верхний угол видимой области с зазором', () => {
    expect(findFreeSpot(view, [])).toEqual({ x: NODE_GAP, y: NODE_GAP });
  });

  it('учитывает сдвиг видимой области (холст прокручен)', () => {
    expect(findFreeSpot({ x: 500, y: -300, w: 800, h: 600 }, [])).toEqual({ x: 500 + NODE_GAP, y: -300 + NODE_GAP });
  });

  it('не ложится на фигуру и на панель поверх холста', () => {
    const toolbar: Rect = { x: 0, y: 0, w: 600, h: 60 };
    const node: Rect = { x: 30, y: 90, w: 200, h: 130 };
    const p = findFreeSpot(view, [toolbar, node]);
    expect(overlap(box(p), toolbar)).toBe(false);
    expect(overlap(box(p), node)).toBe(false);
    expect(insideView(view, p)).toBe(true);
  });

  it('видимая область занята — справа от всех фигур, не поверх', () => {
    const wall: Rect = { x: 0, y: 0, w: 1000, h: 600 };
    const p = findFreeSpot(view, [wall]);
    expect(p.x).toBeGreaterThan(1000);
    expect(insideView(view, p)).toBe(false);
  });
});

describe('findFreeSpots', () => {
  it('четыре клика подряд — четыре места без наложений друг на друга', () => {
    const spots = findFreeSpots(view, [{ x: 400, y: 200, w: 200, h: 130 }], 4).map(box);
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) expect(overlap(spots[i], spots[j])).toBe(false);
    spots.forEach(s => expect(overlap(s, { x: 400, y: 200, w: 200, h: 130 })).toBe(false));
  });
});

describe('fitInsets', () => {
  const pane = { w: 980, h: 600 };

  it('без панелей — базовый отступ со всех сторон', () => {
    expect(fitInsets(pane, [])).toEqual({ top: NODE_GAP, right: NODE_GAP, bottom: NODE_GAP, left: NODE_GAP });
  });

  it('широкий тулбар сверху теснит верх, высокая колонка подсказок — правый край', () => {
    const toolbar: Rect = { x: 15, y: 15, w: 593, h: 46 };
    const guide: Rect = { x: 695, y: 70, w: 270, h: 515 };
    const ins = fitInsets(pane, [toolbar, guide]);
    expect(ins.top).toBe(61 + NODE_GAP);
    expect(ins.right).toBe(980 - 695 + NODE_GAP);
    expect(ins.left).toBe(NODE_GAP);
    expect(ins.bottom).toBe(NODE_GAP);
  });

  it('свёрнутая подсказка (низкая полоса снизу) теснит низ, а не правый край', () => {
    const guideMin: Rect = { x: 695, y: 530, w: 270, h: 55 };
    const ins = fitInsets(pane, [guideMin]);
    expect(ins.bottom).toBe(600 - 530 + NODE_GAP);
    expect(ins.right).toBe(NODE_GAP);
  });

  it('панель не отнимает больше половины холста', () => {
    const huge: Rect = { x: 100, y: 0, w: 880, h: 600 };
    expect(fitInsets(pane, [huge]).right).toBeLessThanOrEqual(pane.w / 2 + NODE_GAP);
  });
});
