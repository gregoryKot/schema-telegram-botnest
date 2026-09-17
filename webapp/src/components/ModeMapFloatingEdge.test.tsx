// @vitest-environment jsdom
// ModeMapFloatingEdge — линия связи между узлами карты режимов (1.5%
// покрытия). Реальный `<ReactFlow nodes={...} edges={...}>` не рисует рёбра в
// jsdom: xyflow вычисляет точку стыковки только для узлов, чьи хэндлы измерил
// настоящий ResizeObserver, а его в jsdom нет (проверено экспериментально —
// EdgeWrapper молча возвращает null при sourceX===null). Поэтому здесь мокаем
// `useInternalNode` (единственный источник геометрии узла для этого
// компонента) и монтируем FloatingEdge рядом с пустым `<ReactFlow>` — так
// EdgeLabelRenderer находит свой портал и подпись/реконнект-точки реально
// попадают в DOM. Гео-логика клика по хэндлам (pointerdown → перетаскивание
// по канвасу) недостижима так же, как drag-connect в ModeMapCanvas — здесь
// проверяется только финальный шаг: «отпустили над узлом» → диспатч события.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, cleanup, screen } from '@testing-library/react';
import {
  renderFloatingEdge,
  internalNode,
  stubNodes,
  getIntersectingNodesMock,
} from './ModeMapFloatingEdge.test-helpers';
import { installFlowTestPolyfills } from '../test-support/renderWithFlow';

beforeEach(() => installFlowTestPolyfills());
afterEach(() => {
  cleanup();
  getIntersectingNodesMock.mockReset();
  getIntersectingNodesMock.mockReturnValue([]);
});

function pathOf(container: HTMLElement): SVGPathElement | null {
  return container.querySelector('path.react-flow__edge-path, svg > path');
}

describe('ModeMapFloatingEdge — узел не найден', () => {
  it('source отсутствует в nodeLookup → ничего не рисует', () => {
    stubNodes({ a: undefined, b: internalNode('b', 'custom', 300, 0) });
    const { container } = renderFloatingEdge();
    expect(pathOf(container)).toBeNull();
  });

  it('target отсутствует в nodeLookup → ничего не рисует', () => {
    stubNodes({ a: internalNode('a', 'custom', 0, 0), b: undefined });
    const { container } = renderFloatingEdge();
    expect(pathOf(container)).toBeNull();
  });
});

describe('ModeMapFloatingEdge — геометрия линии', () => {
  it('между двумя прямоугольными узлами линия идёт от края к краю (не от центра к центру)', () => {
    stubNodes({
      a: internalNode('a', 'custom', 0, 0, { w: 100, h: 50 }),
      b: internalNode('b', 'custom', 300, 0, { w: 100, h: 50 }),
    });
    const { container } = renderFloatingEdge();
    const d = pathOf(container)!.getAttribute('d')!;
    // Центры (50,25) и (350,25) — на боксах края (100,25)/(300,25), минус 1px нахлёста.
    expect(d).toBe('M 99,25L 301,25');
  });

  it('для эллипса (child) точка стыковки отличается от прямоугольной (custom) той же геометрии', () => {
    stubNodes({
      a: internalNode('a', 'child', 0, 0, { w: 100, h: 50 }),
      b: internalNode('b', 'custom', 200, 200, { w: 100, h: 50 }),
    });
    const { container: childContainer } = renderFloatingEdge();
    const childD = pathOf(childContainer)!.getAttribute('d')!;
    cleanup();
    stubNodes({
      a: internalNode('a', 'custom', 0, 0, { w: 100, h: 50 }),
      b: internalNode('b', 'custom', 200, 200, { w: 100, h: 50 }),
    });
    const { container: rectContainer } = renderFloatingEdge();
    const rectD = pathOf(rectContainer)!.getAttribute('d')!;
    expect(childD).not.toBe(rectD);
  });

  it('для щита (coping/avoid) и пятиугольника (coping/over) точка отличается от бокса', () => {
    stubNodes({
      a: internalNode('a', 'coping', 0, 0, {
        w: 100,
        h: 100,
        data: { copingSubtype: 'avoid' },
      }),
      b: internalNode('b', 'custom', 300, 300, { w: 100, h: 100 }),
    });
    const { container: shieldContainer } = renderFloatingEdge();
    const shieldD = pathOf(shieldContainer)!.getAttribute('d')!;
    cleanup();
    stubNodes({
      a: internalNode('a', 'coping', 0, 0, {
        w: 100,
        h: 100,
        data: { copingSubtype: 'over' },
      }),
      b: internalNode('b', 'custom', 300, 300, { w: 100, h: 100 }),
    });
    const { container: pentaContainer } = renderFloatingEdge();
    const pentaD = pathOf(pentaContainer)!.getAttribute('d')!;
    expect(shieldD).not.toBe(pentaD);
  });

  it('trigger (облако) — тоже полигон, не угол бокса', () => {
    stubNodes({
      a: internalNode('a', 'trigger', 0, 0, { w: 100, h: 60 }),
      b: internalNode('b', 'custom', 300, 300, { w: 100, h: 60 }),
    });
    const { container } = renderFloatingEdge();
    expect(pathOf(container)!.getAttribute('d')).toBeTruthy();
  });

  it('для восьмиугольника (critic) точка стыковки — не угол прямоугольного бокса', () => {
    stubNodes({
      a: internalNode('a', 'critic', 0, 0, { w: 100, h: 100 }),
      b: internalNode('b', 'custom', 300, 300, { w: 100, h: 100 }),
    });
    const { container } = renderFloatingEdge();
    const d = pathOf(container)!.getAttribute('d')!;
    // Прямоугольный бокс дал бы диагональ точно в угол (100,100); критик (восьмиугольник)
    // срезает угол — реальная точка стыковки ближе к центру диагонали.
    const m = d.match(/M ([\d.-]+),([\d.-]+)/)!;
    const [, x, y] = m;
    expect(Number(x)).toBeLessThan(100);
    expect(Number(y)).toBeLessThan(100);
  });
});

describe('ModeMapFloatingEdge — выделение и стиль', () => {
  beforeEach(() => {
    stubNodes({
      a: internalNode('a', 'custom', 0, 0, { w: 100, h: 50 }),
      b: internalNode('b', 'custom', 300, 0, { w: 100, h: 50 }),
    });
  });

  it('selected=false использует переданный style как есть', () => {
    const { container } = renderFloatingEdge({
      style: { stroke: 'red', strokeWidth: 2.5 },
    });
    const path = pathOf(container)!;
    expect(path.style.stroke).toBe('red');
    expect(path.style.strokeWidth).toBe('2.5');
  });

  it('selected=true подсвечивает линию акцентным цветом и увеличивает толщину', () => {
    const { container } = renderFloatingEdge({
      selected: true,
      style: { stroke: 'red', strokeWidth: 2.5 },
    });
    const path = pathOf(container)!;
    expect(path.style.stroke).toBe('var(--accent)');
    expect(Number(path.style.strokeWidth)).toBeCloseTo(3.7, 1);
  });

  it('подпись рендерится независимо от выбора ребра', () => {
    const { queryByText } = renderFloatingEdge({
      selected: false,
      label: 'активирует',
    });
    expect(queryByText('активирует')).toBeTruthy();
  });
});

describe('ModeMapFloatingEdge — реконнект (перетаскивание конца ребра)', () => {
  beforeEach(() => {
    stubNodes({
      a: internalNode('a', 'custom', 0, 0, { w: 100, h: 50 }),
      b: internalNode('b', 'custom', 300, 0, { w: 100, h: 50 }),
    });
  });

  it('точки реконнекта видны только когда ребро выбрано', () => {
    renderFloatingEdge({ selected: false });
    expect(screen.queryAllByTitle('Перетащи на другой режим')).toHaveLength(0);
    cleanup();
    stubNodes({
      a: internalNode('a', 'custom', 0, 0, { w: 100, h: 50 }),
      b: internalNode('b', 'custom', 300, 0, { w: 100, h: 50 }),
    });
    renderFloatingEdge({ selected: true });
    expect(screen.queryAllByTitle('Перетащи на другой режим')).toHaveLength(2);
  });

  it('отпускание над другим узлом диспатчит modemap-reconnect с его id', () => {
    getIntersectingNodesMock.mockReturnValue([{ id: 'c' }]);
    renderFloatingEdge({ selected: true });
    const [sourceDot] = screen.getAllByTitle('Перетащи на другой режим');
    const handler = vi.fn();
    window.addEventListener('modemap-reconnect', handler);
    try {
      fireEvent.pointerDown(sourceDot, { clientX: 99, clientY: 25 });
      fireEvent.pointerUp(window, { clientX: 400, clientY: 25 });
      expect(handler).toHaveBeenCalledTimes(1);
      const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
      expect(detail).toMatchObject({ id: 'e1', end: 'source', nodeId: 'c' });
    } finally {
      window.removeEventListener('modemap-reconnect', handler);
    }
  });
});
