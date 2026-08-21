// @vitest-environment jsdom
// ModeMapEditor — редактирование/удаление/разворот ребра и отказ автосейва.
// Настоящий ReactFlow не рисует рёбра в jsdom (нет ResizeObserver-измерения
// хэндлов, см. комментарий в ModeMapFloatingEdge.test.tsx) — кликнуть по
// ребру на холсте здесь нельзя физически. Поэтому './ModeMapCanvas' мокнута
// маленькой заглушкой с кнопкой «выбрать ребро» (эмулирует onEdgeClick) —
// дальше рендерится настоящий ModeMapEdgeEditor (боковая панель редактора не
// мокнута), и тестируется именно проводка ModeMapEditor: handleEdgeChange/
// handleDeleteEdge/handleSwapEdge/scheduleSave, которую в ModeMapEditor.test.tsx
// физически не достать.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ModeMapEditor } from './ModeMapEditor';
import type { ModeMapNode, ModeMapEdge } from '../api';

const updateModeMap = vi.fn();
vi.mock('../api', () => ({
  api: {
    updateModeMap: (...a: unknown[]) => updateModeMap(...a),
    getConceptualization: vi.fn().mockResolvedValue(null),
    listCustomModes: vi.fn().mockResolvedValue([]),
    createCustomMode: vi.fn().mockResolvedValue({}),
    deleteCustomMode: vi.fn().mockResolvedValue(undefined),
  },
  reportClientError: vi.fn(),
}));

vi.mock('./ModeMapCanvas', () => ({
  ModeMapCanvas: (props: {
    setSelectedEdgeId: (id: string | null) => void;
    saveStatus: string;
  }) => (
    <div>
      <button onClick={() => props.setSelectedEdgeId('e1')}>выбрать ребро e1</button>
      <span>статус:{props.saveStatus}</span>
    </div>
  ),
}));

function mmNode(id: string, type: ModeMapNode['type'], label: string): ModeMapNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label } };
}
function mmEdge(id: string, source: string, target: string): ModeMapEdge {
  return { id, source, target, data: { edgeType: 'activates' } };
}

function renderEditorWithEdge() {
  return render(
    <ModeMapEditor
      mapId={1}
      clientId={7}
      kind="problem"
      initialNodes={[mmNode('n1', 'trigger', 'Триггер'), mmNode('n2', 'behavior', 'Поведение')]}
      initialEdges={[mmEdge('e1', 'n1', 'n2')]}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  updateModeMap.mockResolvedValue({});
  window.innerWidth = 1200;
});
afterEach(() => cleanup());

describe('ModeMapEditor — редактор ребра (read-after-write)', () => {
  it('выбор ребра открывает редактор связи', () => {
    renderEditorWithEdge();
    fireEvent.click(screen.getByText('выбрать ребро e1'));
    expect(screen.getByText('Связь')).toBeTruthy();
  });

  it('смена типа связи меняет edgeType ребра и уходит в автосейв', async () => {
    renderEditorWithEdge();
    fireEvent.click(screen.getByText('выбрать ребро e1'));
    await act(async () => {});
    vi.useFakeTimers();
    try {
      // По умолчанию edgeType='activates' — переключаем на другой тип, чтобы
      // проверить реальное изменение (случайная подсказанная фраза для
      // 'activates' не детерминирована, edgeType — да).
      fireEvent.click(screen.getByText('ведёт к'));
      await vi.advanceTimersByTimeAsync(1300);
      expect(updateModeMap).toHaveBeenCalled();
      const lastCall = updateModeMap.mock.calls.at(-1)!;
      const body = lastCall[1] as { edges: ModeMapEdge[] };
      expect(body.edges[0].data?.edgeType).toBe('leads_to');
    } finally {
      vi.useRealTimers();
    }
  });

  it('«Развернуть» меняет местами source/target ребра и сохраняет', async () => {
    renderEditorWithEdge();
    fireEvent.click(screen.getByText('выбрать ребро e1'));
    await act(async () => {});
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByLabelText('Развернуть (поменять начало и конец)'));
      await vi.advanceTimersByTimeAsync(1300);
      const body = updateModeMap.mock.calls.at(-1)![1] as { edges: ModeMapEdge[] };
      expect(body.edges[0]).toEqual(expect.objectContaining({ source: 'n2', target: 'n1' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('«Удалить связь» убирает ребро из сохранённой модели', async () => {
    renderEditorWithEdge();
    fireEvent.click(screen.getByText('выбрать ребро e1'));
    await act(async () => {});
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByText('Удалить связь'));
      expect(screen.queryByText('Связь')).toBeNull();
      await vi.advanceTimersByTimeAsync(1300);
      const body = updateModeMap.mock.calls.at(-1)![1] as { edges: ModeMapEdge[] };
      expect(body.edges).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('«Закрыть» в редакторе связи снимает выделение без изменения модели', () => {
    renderEditorWithEdge();
    fireEvent.click(screen.getByText('выбрать ребро e1'));
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(screen.queryByText('Связь')).toBeNull();
    expect(updateModeMap).not.toHaveBeenCalled();
  });
});

describe('ModeMapEditor — сбой автосейва не роняет экран', () => {
  it('провал api.updateModeMap возвращает статус в исходное состояние (idle), не крашится', async () => {
    updateModeMap.mockRejectedValue(new Error('network'));
    renderEditorWithEdge();
    fireEvent.click(screen.getByText('выбрать ребро e1'));
    await act(async () => {});
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByText('Удалить связь'));
      await vi.advanceTimersByTimeAsync(1300);
      expect(updateModeMap).toHaveBeenCalled();
      expect(screen.getByText('статус:idle')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

// РЕГРЕССИЯ: фикс cleanup-эффекта размонтирования (см. ModeMapEditor.test.tsx)
// не должен трогать поведение, пока экран открыт — статус по-прежнему
// проходит idle → saving → saved ровно через 1200мс после правки.
describe('ModeMapEditor — пока смонтирован, автосейв работает как раньше', () => {
  it('правка → 1200мс → статус idle → saving → saved', async () => {
    let resolveUpdate: (v: unknown) => void = () => {};
    updateModeMap.mockImplementation(
      () => new Promise((resolve) => { resolveUpdate = resolve; }),
    );
    renderEditorWithEdge();
    fireEvent.click(screen.getByText('выбрать ребро e1'));
    await act(async () => {});
    vi.useFakeTimers();
    try {
      expect(screen.getByText('статус:idle')).toBeTruthy();
      fireEvent.click(screen.getByText('ведёт к'));
      expect(screen.getByText('статус:idle')).toBeTruthy(); // таймер ещё не сработал

      await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
      expect(screen.getByText('статус:saving')).toBeTruthy(); // запрос ушёл, ответа ещё нет

      await act(async () => { resolveUpdate({}); });
      expect(screen.getByText('статус:saved')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

// РЕГРЕССИЯ: размонтирование со взведённым таймером не должно звать
// setSaveStatus на пропавшем дереве и не должно терять правку. Детальные
// кейсы (провал сохранения, уже сработавший таймер, пустое размонтирование)
// проверены изолированно в useModeMapAutosave.test.ts — здесь только сквозная
// сверка через мок-холст: пропс saveStatus реального ModeMapEditor.
describe('ModeMapEditor — размонтирование со взведённым таймером (мок-холст)', () => {
  it('размонтирование посреди 1200мс окна не бросает и отправляет правку немедленно', async () => {
    const { unmount } = renderEditorWithEdge();
    fireEvent.click(screen.getByText('выбрать ребро e1'));
    await act(async () => {});
    fireEvent.click(screen.getByText('ведёт к')); // взводит таймер, ещё не сработал
    expect(updateModeMap).not.toHaveBeenCalled();

    expect(() => unmount()).not.toThrow();

    expect(updateModeMap).toHaveBeenCalledTimes(1);
    const body = updateModeMap.mock.calls.at(-1)![1] as { edges: ModeMapEdge[] };
    expect(body.edges[0].data?.edgeType).toBe('leads_to');
  });
});
