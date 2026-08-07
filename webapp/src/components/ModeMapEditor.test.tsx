// @vitest-environment jsdom
// ModeMapEditor — сборка палитры + холста + бокового редактора (0% покрытия).
// Рендерим по-настоящему (палитра и холст не мокаются — их проверенное
// поведение и есть то, что должен собрать ModeMapEditor). Проверяем сквозной
// путь пользователя: выбрал режим в палитре → он появился на холсте → выбрал
// узел → открылась форма редактора → изменения долетают до debounced
// api.updateModeMap (read-after-write, CLAUDE.md).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeMapEditor } from './ModeMapEditor';
import type { ModeMapNode, ModeMapEdge } from '../api';
import { installFlowTestPolyfills } from '../test-support/renderWithFlow';

const updateModeMap = vi.fn();
const getConceptualization = vi.fn();
const listCustomModes = vi.fn();
vi.mock('../api', () => ({
  api: {
    updateModeMap: (...a: unknown[]) => updateModeMap(...a),
    getConceptualization: (...a: unknown[]) => getConceptualization(...a),
    listCustomModes: (...a: unknown[]) => listCustomModes(...a),
    createCustomMode: vi.fn().mockResolvedValue({}),
    deleteCustomMode: vi.fn().mockResolvedValue(undefined),
  },
}));

function mmNode(
  id: string,
  type: ModeMapNode['type'],
  label: string,
  extra: Partial<ModeMapNode['data']> = {},
): ModeMapNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label, ...extra } };
}
function mmEdge(id: string, source: string, target: string): ModeMapEdge {
  return { id, source, target, data: { edgeType: 'activates' } };
}

function renderEditor(nodes: ModeMapNode[] = [], edges: ModeMapEdge[] = []) {
  return render(
    <ModeMapEditor
      mapId={1}
      clientId={7}
      kind="problem"
      initialNodes={nodes}
      initialEdges={edges}
    />,
  );
}

// jsdom не реализует DOMMatrixReadOnly — xyflow дёргает его при пересчёте
// внутренних размеров узла (updateNodeInternals), это срабатывает только на
// смене типа узла (другая форма/размер). Минимальный стаб — m22 (zoom) не
// важен для этого теста, значение не проверяется.
class DOMMatrixReadOnlyStub {
  m22 = 1;
  constructor(_transform?: string) {
    void _transform;
  }
}

beforeEach(() => {
  installFlowTestPolyfills();
  (window as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly =
    DOMMatrixReadOnlyStub;
  localStorage.clear();
  vi.clearAllMocks();
  getConceptualization.mockResolvedValue(null);
  listCustomModes.mockResolvedValue([]);
  updateModeMap.mockResolvedValue({});
  window.innerWidth = 1200; // десктоп: палитра инлайн-колонкой, не drawer
});
afterEach(() => cleanup());

describe('ModeMapEditor — палитра → холст', () => {
  it('клик по режиму в палитре добавляет узел на холст', () => {
    renderEditor();
    fireEvent.click(screen.getByText('Триггер / Ситуация'));
    expect(screen.getByText('Триггер')).toBeTruthy();
  });

  it('кнопка «Скрыть панель режимов» прячет палитру, «Показать» возвращает', () => {
    renderEditor();
    expect(screen.getByPlaceholderText('Поиск режима…')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Скрыть панель режимов'));
    expect(screen.queryByPlaceholderText('Поиск режима…')).toBeNull();
    fireEvent.click(screen.getByLabelText('Показать панель режимов'));
    expect(screen.getByPlaceholderText('Поиск режима…')).toBeTruthy();
  });
});

describe('ModeMapEditor — массовое добавление и смена типа узла', () => {
  it('«вынести все режимы клиента» из палитры добавляет несколько узлов разом', async () => {
    getConceptualization.mockResolvedValue({
      modeIds: ['vulnerable_child', 'demanding_critic'],
    });
    renderEditor();
    await screen.findByText('▼ 2', {}, { timeout: 8000 });
    fireEvent.click(
      screen.getByLabelText('Вынести все режимы клиента на карту'),
    );
    expect(
      screen
        .getAllByText('Уязвимый Ребёнок')
        .some((el) => el.closest('.react-flow__node')),
    ).toBe(true);
    expect(
      screen
        .getAllByText('Требовательный Критик')
        .some((el) => el.closest('.react-flow__node')),
    ).toBe(true);
  });

  it('смена фигуры в редакторе узла меняет тип узла на холсте', () => {
    renderEditor([mmNode('n1', 'child', 'Ребёнок')]);
    fireEvent.click(screen.getByText('Ребёнок').closest('.react-flow__node')!);
    fireEvent.click(screen.getByTitle('Здоров'));
    const el = screen.getByText('Ребёнок').closest('.react-flow__node')!;
    expect(el.className).toContain('react-flow__node-healthy');
  });
});

describe('ModeMapEditor — выбор узла открывает редактор', () => {
  it('клик по узлу на холсте открывает форму с его названием', () => {
    renderEditor([mmNode('n1', 'child', 'Уязвимый Ребёнок')]);
    fireEvent.click(
      screen.getByText('Уязвимый Ребёнок').closest('.react-flow__node')!,
    );
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe(
      'Уязвимый Ребёнок',
    );
  });

  it('«Закрыть» в редакторе узла снимает выделение и закрывает форму', () => {
    renderEditor([mmNode('n1', 'child', 'Уязвимый Ребёнок')]);
    fireEvent.click(
      screen.getByText('Уязвимый Ребёнок').closest('.react-flow__node')!,
    );
    expect(screen.getByLabelText('Название')).toBeTruthy();
    // Индекс 0 — кнопка «Закрыть» гайда (открыт по умолчанию), индекс 1 — самого редактора узла.
    fireEvent.click(screen.getAllByLabelText('Закрыть')[1]);
    expect(screen.queryByLabelText('Название')).toBeNull();
  });
});

describe('ModeMapEditor — удаление узла снимает и его рёбра (read-after-write)', () => {
  it('«Удалить ноду» в редакторе убирает узел и его связи из сохранённой модели', async () => {
    vi.useFakeTimers();
    try {
      renderEditor(
        [
          mmNode('n1', 'trigger', 'Триггер'),
          mmNode('n2', 'behavior', 'Поведение'),
        ],
        [mmEdge('e1', 'n1', 'n2')],
      );
      fireEvent.click(
        screen.getByText('Триггер').closest('.react-flow__node')!,
      );
      fireEvent.click(screen.getByText('Удалить ноду'));
      expect(screen.queryByText('Триггер')).toBeNull();

      await vi.advanceTimersByTimeAsync(1300);

      expect(updateModeMap).toHaveBeenCalled();
      const lastCall = updateModeMap.mock.calls.at(-1)!;
      const body = lastCall[1] as {
        nodes: ModeMapNode[];
        edges: ModeMapEdge[];
      };
      expect(body.nodes.map((n) => n.id)).toEqual(['n2']);
      expect(body.edges).toEqual([]); // ребро на удалённый узел не осталось «повисшим»
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ModeMapEditor — горячие клавиши', () => {
  it('Escape снимает выделение узла', () => {
    renderEditor([mmNode('n1', 'child', 'Ребёнок')]);
    fireEvent.click(screen.getByText('Ребёнок').closest('.react-flow__node')!);
    expect(screen.getByLabelText('Название')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByLabelText('Название')).toBeNull();
  });

  it('Backspace удаляет выбранный узел вместе с его рёбрами', async () => {
    vi.useFakeTimers();
    try {
      renderEditor(
        [
          mmNode('n1', 'trigger', 'Триггер'),
          mmNode('n2', 'behavior', 'Поведение'),
        ],
        [mmEdge('e1', 'n1', 'n2')],
      );
      fireEvent.click(
        screen.getByText('Триггер').closest('.react-flow__node')!,
      );
      fireEvent.keyDown(window, { key: 'Backspace' });
      expect(screen.queryByText('Триггер')).toBeNull();

      await vi.advanceTimersByTimeAsync(1300);
      const body = updateModeMap.mock.calls.at(-1)![1] as {
        nodes: ModeMapNode[];
        edges: ModeMapEdge[];
      };
      expect(body.edges).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Backspace с фокусом в текстовом поле не удаляет узел (не перехватывает ввод)', () => {
    renderEditor([mmNode('n1', 'child', 'Ребёнок')]);
    fireEvent.click(screen.getByText('Ребёнок').closest('.react-flow__node')!);
    const nameField = screen.getByLabelText('Название');
    fireEvent.keyDown(nameField, { key: 'Backspace' });
    expect(screen.getByText('Ребёнок')).toBeTruthy();
  });

  it('⌘Z отменяет последнее действие (удаление узла)', () => {
    renderEditor([mmNode('n1', 'trigger', 'Триггер')]);
    fireEvent.click(screen.getByText('Триггер').closest('.react-flow__node')!);
    fireEvent.click(screen.getByText('Удалить ноду'));
    expect(screen.queryByText('Триггер')).toBeNull();
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(screen.getByText('Триггер')).toBeTruthy();
  });

  it('⌘D дублирует выбранный узел', () => {
    renderEditor([mmNode('n1', 'trigger', 'Триггер')]);
    fireEvent.click(screen.getByText('Триггер').closest('.react-flow__node')!);
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    // Гайд тоже упоминает «Триггер» (мини-превью цепочки) — считаем только узлы холста.
    const onCanvas = screen
      .getAllByText('Триггер')
      .filter((el) => el.closest('.react-flow__node'));
    expect(onCanvas).toHaveLength(2);
  });
});

describe('ModeMapEditor — мобильная раскладка', () => {
  it('на мобильном палитра стартует скрытой и открывается оверлеем по кнопке', () => {
    window.innerWidth = 500;
    renderEditor();
    expect(screen.queryByPlaceholderText('Поиск режима…')).toBeNull();
    fireEvent.click(screen.getByLabelText('Показать панель режимов'));
    expect(screen.getByPlaceholderText('Поиск режима…')).toBeTruthy();
  });

  it('на мобильном выбор узла открывает редактор оверлеем поверх холста', () => {
    window.innerWidth = 500;
    renderEditor([mmNode('n1', 'child', 'Ребёнок')]);
    fireEvent.click(screen.getByText('Ребёнок').closest('.react-flow__node')!);
    expect(screen.getByLabelText('Название')).toBeTruthy();
  });
});
