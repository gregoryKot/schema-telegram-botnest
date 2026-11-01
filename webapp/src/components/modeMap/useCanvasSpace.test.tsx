// @vitest-environment jsdom
// useCanvasSpace — замер DOM холста карты режимов (QA 2026-10-26: фигуры из
// палитры ложились друг на друга, «Показать всё» прятало их под подсказками).
// Чистая геометрия — в canvasSpace.test.ts; здесь шов с React Flow: перевод
// экранных прямоугольников в координаты холста через transform (сдвиг и зум),
// панели поверх холста как занятые места, отступы fitView и отложенный fit.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';

const fitView = vi.fn();
let state: { domNode: HTMLElement | null; transform: [number, number, number] };

vi.mock('@xyflow/react', () => ({
  useStoreApi: () => ({ getState: () => state }),
  useReactFlow: () => ({ fitView }),
}));

import { useCanvasSpace } from './useCanvasSpace';

type Box = { left: number; top: number; width: number; height: number };
function withRect<T extends HTMLElement>(el: T, b: Box): T {
  el.getBoundingClientRect = () => ({
    ...b, x: b.left, y: b.top, right: b.left + b.width, bottom: b.top + b.height, toJSON: () => b,
  }) as DOMRect;
  return el;
}

/** Холст на экране: `pane` — сам холст, `panels` — панели поверх него (экранные px). */
function mountPane(pane: Box, panels: Box[] = []): HTMLElement {
  const dom = withRect(document.createElement('div'), pane);
  for (const p of panels) {
    const el = withRect(document.createElement('div'), p);
    el.className = 'react-flow__panel';
    dom.appendChild(el);
  }
  return dom;
}

const node = (x: number, y: number, measured?: { width: number; height: number }): Node =>
  ({ id: `${x}-${y}`, position: { x, y }, data: {}, ...(measured ? { measured } : {}) }) as Node;

// Холст 800×600 со сдвигом (10, 20) на странице: тулбар во всю ширину сверху
// (48px) и колонка подсказок справа (200px) под ним.
const PANE = { left: 10, top: 20, width: 800, height: 600 };
const TOOLBAR = { left: 10, top: 20, width: 800, height: 48 };
const GUIDE = { left: 610, top: 68, width: 200, height: 552 };

beforeEach(() => {
  fitView.mockReset();
  state = { domNode: null, transform: [0, 0, 1] };
});
afterEach(() => vi.useRealTimers());

describe('useCanvasSpace — place: видимая область с учётом сдвига, зума и панелей', () => {
  it('фигура ложится в видимую часть холста (transform -100,-50, зум 2), не под тулбар и не под подсказки', () => {
    // Видимая область в координатах холста: x 50…450, y 25…325. Тулбар — y 25…49,
    // подсказки — x 350…450. Свободно только окно x 74…126, y 73…171.
    state = { domNode: mountPane(PANE, [TOOLBAR, GUIDE]), transform: [-100, -50, 2] };
    const { result } = renderHook(() => useCanvasSpace());
    const [p] = result.current.place([]);
    expect(p).toEqual({ x: 74, y: 126 });
  });

  it('размер занятой фигуры — из measured: широкий узел сдвигает новую фигуру правее', () => {
    state = { domNode: mountPane({ left: 0, top: 0, width: 1000, height: 400 }), transform: [0, 0, 1] };
    const { result } = renderHook(() => useCanvasSpace());
    // По умолчанию (200px) место нашлось бы на x=248; узел шириной 300 занимает до 348 + зазор.
    expect(result.current.place([node(24, 24, { width: 300, height: 130 })])).toEqual([{ x: 360, y: 24 }]);
    expect(result.current.place([node(24, 24)])).toEqual([{ x: 248, y: 24 }]);
  });

  it('видимая область занята — фигура справа от всех, и через 60 мс «Показать всё» с отступами под панели', () => {
    vi.useFakeTimers();
    state = { domNode: mountPane(PANE, [TOOLBAR, GUIDE]), transform: [-100, -50, 2] };
    const { result } = renderHook(() => useCanvasSpace());
    const spots = result.current.place([], 2);
    expect(spots[0]).toEqual({ x: 74, y: 126 });
    expect(spots[1]).toEqual({ x: 498, y: 49 }); // правее подсказок (450) на два зазора
    expect(fitView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60);
    expect(fitView).toHaveBeenCalledTimes(1);
    expect(fitView.mock.calls[0][0]).toMatchObject({ maxZoom: 1, duration: 300, padding: { top: '72px', right: '224px' } });
  });

  it('всё поместилось — отложенного fit нет', () => {
    vi.useFakeTimers();
    state = { domNode: mountPane(PANE, [TOOLBAR, GUIDE]), transform: [-100, -50, 2] };
    const { result } = renderHook(() => useCanvasSpace());
    result.current.place([]);
    vi.advanceTimersByTime(500);
    expect(fitView).not.toHaveBeenCalled();
  });

  it('холст не измерен (скрытая вкладка) — лесенкой от последней фигуры', () => {
    state = { domNode: mountPane({ left: 0, top: 0, width: 0, height: 0 }), transform: [0, 0, 1] };
    const { result } = renderHook(() => useCanvasSpace());
    expect(result.current.place([node(0, 0), node(100, 100)], 2)).toEqual([{ x: 140, y: 140 }, { x: 180, y: 180 }]);
    state = { domNode: null, transform: [0, 0, 1] };
    expect(result.current.place([])).toEqual([{ x: 200, y: 120 }]);
  });
});

describe('useCanvasSpace — fit / fitOptions: отступы по реальным панелям, без увеличения сверх 100%', () => {
  it('тулбар — отступ сверху, колонка подсказок — справа; остальные стороны — базовый зазор', () => {
    state = { domNode: mountPane(PANE, [TOOLBAR, GUIDE]), transform: [-100, -50, 2] };
    const { result } = renderHook(() => useCanvasSpace());
    const padding = { top: '72px', right: '224px', bottom: '24px', left: '24px' };
    expect(result.current.fitOptions()).toEqual({ padding, maxZoom: 1 });
    result.current.fit(400);
    expect(fitView).toHaveBeenCalledWith({ padding, maxZoom: 1, duration: 400 });
  });

  it('холст не измерен — только запрет увеличения, отступ React Flow по умолчанию', () => {
    const { result } = renderHook(() => useCanvasSpace());
    expect(result.current.fitOptions()).toEqual({ maxZoom: 1 });
    result.current.fit();
    expect(fitView).toHaveBeenCalledWith({ maxZoom: 1, duration: 300 });
  });
});
