// @vitest-environment jsdom
// ModeMapCanvas — выделение, контекстные меню, drop с палитры и реконнект
// рёбер. Настоящий drag-connect (мышь по хэндлам) недостижим в jsdom: xyflow
// требует реально измеренные ResizeObserver'ом границы хэндлов, которых в
// jsdom не существует — этот путь покрыт на уровне «перетащи конец ребра»
// (кастомное событие modemap-reconnect, которое ModeMapFloatingEdge реально
// диспатчит при драге его хэндла), а pure-логика создания ребра (edgeColor/
// edgeStyle/makeMarker) уже покрыта modeMapFlow.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  renderCanvas,
  mmNode,
  mmEdge,
  readModel,
  getConceptualization,
} from './ModeMapCanvas.test-helpers';
import { installFlowTestPolyfills } from '../test-support/renderWithFlow';

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
  getConceptualization.mockReset();
  getConceptualization.mockResolvedValue(null);
});
afterEach(() => cleanup());

function nodeEl(label: string) {
  return screen.getByText(label).closest('.react-flow__node')!;
}

describe('ModeMapCanvas — выбор узла кликом', () => {
  it('клик по узлу помечает его выбранным (debug-снапшот selectedNodeId)', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.click(nodeEl('Триггер'));
    expect(
      container.querySelector('[data-testid="mm-debug-selected"]')!.textContent,
    ).toBe('n1');
  });

  it('клик по пустому месту холста снимает выбор', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.click(nodeEl('Триггер'));
    const pane = container.querySelector('.react-flow__pane')!;
    fireEvent.click(pane);
    expect(
      container.querySelector('[data-testid="mm-debug-selected"]')!.textContent,
    ).toBe('');
  });
});

describe('ModeMapCanvas — контекстное меню узла', () => {
  it('«Дублировать» создаёт второй узел с тем же названием', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.contextMenu(nodeEl('Триггер'));
    fireEvent.click(screen.getByText('Дублировать'));
    expect(readModel(container).nodes).toHaveLength(2);
    expect(screen.getAllByText('Триггер')).toHaveLength(2);
  });

  it('регресс: два «Дублировать» подряд в ту же миллисекунду не сталкивают id узлов', () => {
    // Баг: duplicateNode строил id только из Date.now() — второй клик в тот же
    // мс порождал узел с тем же id, что и первая копия (та же проблема, что
    // была в modeMapLayout.templateToGraph и решена random-суффиксом в ⌘D,
    // см. ModeMapEditor.tsx). Замораживаем часы, чтобы воспроизвести детерминированно.
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    try {
      const { container } = renderCanvas({
        initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
      });
      fireEvent.contextMenu(nodeEl('Триггер'));
      fireEvent.click(screen.getByText('Дублировать'));
      fireEvent.contextMenu(
        screen.getAllByText('Триггер')[0].closest('.react-flow__node')!,
      );
      fireEvent.click(screen.getByText('Дублировать'));
      const model = readModel(container);
      expect(model.nodes).toHaveLength(3);
      expect(new Set(model.nodes.map((n) => n.id)).size).toBe(3);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('«Удалить» убирает узел И его рёбра (не оставляет висячих связей)', () => {
    const { container } = renderCanvas({
      initialNodes: [
        mmNode('n1', 'trigger', { label: 'Триггер' }),
        mmNode('n2', 'behavior', { label: 'Поведение' }),
      ],
      initialEdges: [mmEdge('e1', 'n1', 'n2')],
    });
    expect(readModel(container).edges).toHaveLength(1);
    fireEvent.contextMenu(nodeEl('Триггер'));
    fireEvent.click(screen.getByText('Удалить'));
    const model = readModel(container);
    expect(model.nodes.map((n) => n.id)).toEqual(['n2']);
    expect(model.edges).toHaveLength(0);
  });

  it('«Удалить» снимает выделение узла', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.click(nodeEl('Триггер'));
    fireEvent.contextMenu(nodeEl('Триггер'));
    fireEvent.click(screen.getByText('Удалить'));
    expect(
      container.querySelector('[data-testid="mm-debug-selected"]')!.textContent,
    ).toBe('');
  });
});

describe('ModeMapCanvas — контекстное меню фона', () => {
  it('правый клик по фону показывает «Авто-расположение» и «Показать всё»', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    const pane = container.querySelector('.react-flow__pane')!;
    fireEvent.contextMenu(pane);
    expect(screen.getByText('Авто-расположение')).toBeTruthy();
    expect(screen.getByText('Показать всё')).toBeTruthy();
  });

  it('клик по «Авто-расположение» из меню фона не роняет холст', () => {
    const { container } = renderCanvas({
      initialNodes: [
        mmNode('n1', 'trigger', { label: 'Триггер' }),
        mmNode('n2', 'behavior', { label: 'Поведение' }),
      ],
      initialEdges: [mmEdge('e1', 'n1', 'n2')],
    });
    const pane = container.querySelector('.react-flow__pane')!;
    fireEvent.contextMenu(pane);
    fireEvent.click(screen.getByText('Авто-расположение'));
    expect(readModel(container).nodes).toHaveLength(2);
  });
});

describe('ModeMapCanvas — drop узла с палитры', () => {
  function paletteDataTransfer(payload: unknown) {
    const data: Record<string, string> = {
      'application/modemap-node': JSON.stringify(payload),
    };
    return {
      getData: (t: string) => data[t] ?? '',
      setData: (t: string, v: string) => {
        data[t] = v;
      },
      dropEffect: 'copy',
      effectAllowed: 'copy',
    };
  }

  it('drop с валидным payload добавляет новый узел на карту', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    const pane = container.querySelector('.react-flow__pane') as HTMLElement;
    const dataTransfer = paletteDataTransfer({
      id: 'child_1',
      type: 'child',
      data: { label: 'Уязвимый Ребёнок' },
    });
    fireEvent.dragOver(pane, { dataTransfer });
    fireEvent.drop(pane, { dataTransfer, clientX: 120, clientY: 80 });
    const model = readModel(container);
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0]).toMatchObject({
      type: 'child',
      label: 'Уязвимый Ребёнок',
    });
  });

  it('drop без данных (пустой dataTransfer) ничего не добавляет', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    const pane = container.querySelector('.react-flow__pane') as HTMLElement;
    const dataTransfer = {
      getData: () => '',
      setData: () => {},
      dropEffect: 'copy',
    };
    fireEvent.drop(pane, { dataTransfer });
    expect(readModel(container).nodes).toHaveLength(0);
  });

  it('drop с битым JSON payload не роняет холст и не добавляет узел', () => {
    const { container } = renderCanvas({ initialNodes: [] });
    const pane = container.querySelector('.react-flow__pane') as HTMLElement;
    const dataTransfer = {
      getData: () => '{не json',
      setData: () => {},
      dropEffect: 'copy',
    };
    expect(() => fireEvent.drop(pane, { dataTransfer })).not.toThrow();
    expect(readModel(container).nodes).toHaveLength(0);
  });
});

describe('ModeMapCanvas — реконнект ребра (modemap-reconnect)', () => {
  it('перенос конца ребра на другой узел переписывает target', () => {
    const { container } = renderCanvas({
      initialNodes: [
        mmNode('a', 'trigger', { label: 'Триггер' }),
        mmNode('b', 'behavior', { label: 'Поведение' }),
        mmNode('c', 'critic', { label: 'Критик' }),
      ],
      initialEdges: [mmEdge('e1', 'a', 'b')],
    });
    act(() => {
      window.dispatchEvent(
        new CustomEvent('modemap-reconnect', {
          detail: { id: 'e1', end: 'target', nodeId: 'c' },
        }),
      );
    });
    const model = readModel(container);
    expect(model.edges).toEqual([{ id: 'e1', source: 'a', target: 'c' }]);
  });

  it('реконнект на тот же узел (self-loop) игнорируется', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('a', 'trigger'), mmNode('b', 'behavior')],
      initialEdges: [mmEdge('e1', 'a', 'b')],
    });
    window.dispatchEvent(
      new CustomEvent('modemap-reconnect', {
        detail: { id: 'e1', end: 'target', nodeId: 'a' },
      }),
    );
    expect(readModel(container).edges).toEqual([
      { id: 'e1', source: 'a', target: 'b' },
    ]);
  });

  it('реконнект несуществующего ребра ничего не ломает', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('a', 'trigger'), mmNode('b', 'behavior')],
      initialEdges: [mmEdge('e1', 'a', 'b')],
    });
    expect(() =>
      window.dispatchEvent(
        new CustomEvent('modemap-reconnect', {
          detail: { id: 'ghost', end: 'target', nodeId: 'a' },
        }),
      ),
    ).not.toThrow();
    expect(readModel(container).edges).toEqual([
      { id: 'e1', source: 'a', target: 'b' },
    ]);
  });
});

describe('ModeMapCanvas — двойной клик открывает поле названия', () => {
  it('двойной клик по узлу выделяет его (данные для дальнейшего onOpenNeed/фокуса)', () => {
    // onNodeDoubleClick планирует window.dispatchEvent через setTimeout(30) —
    // фейковые таймеры не дают ему пережить тест и выстрелить в чужом jsdom
    // окружении следующего файла (иначе падает «window is not defined»).
    vi.useFakeTimers();
    try {
      const { container } = renderCanvas({
        initialNodes: [mmNode('n1', 'child', { label: 'Ребёнок' })],
      });
      fireEvent.doubleClick(nodeEl('Ребёнок'));
      expect(
        container.querySelector('[data-testid="mm-debug-selected"]')!
          .textContent,
      ).toBe('n1');
      vi.runOnlyPendingTimers();
    } finally {
      vi.useRealTimers();
    }
  });
});
