// @vitest-environment jsdom
// РЕГРЕССИЯ: scheduleSave заводил setTimeout на 1200мс без эффекта очистки —
// уход с экрана раньше срабатывания таймера либо терял правку, либо звал
// setState на размонтированном дереве (гонка, обнажённая vitest --coverage:
// «Unhandled Rejection» на listOnTimeout после teardown, ModeMapEditor.test.tsx).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModeMapAutosave } from './useModeMapAutosave';
import type { FlowNode, FlowEdge } from './modeMapFlow';

const updateModeMap = vi.fn();
const reportClientError = vi.fn();
vi.mock('../api', () => ({
  api: { updateModeMap: (...a: unknown[]) => updateModeMap(...a) },
  reportClientError: (...a: unknown[]) => reportClientError(...a),
}));

const node = (id: string): FlowNode => ({ id, position: { x: 0, y: 0 }, data: {} });

function setup(mapId = 1, nodes: FlowNode[] = [node('a')]) {
  const nodesRef = { current: nodes };
  const edgesRef = { current: [] as FlowEdge[] };
  const view = renderHook(
    ({ id }: { id: number }) => useModeMapAutosave(id, nodesRef, edgesRef),
    { initialProps: { id: mapId } },
  );
  return { ...view, nodesRef, edgesRef };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateModeMap.mockResolvedValue({});
});

describe('useModeMapAutosave — пока смонтирован, поведение прежнее', () => {
  it('scheduleSave → 1200мс → статус pending → saving → saved с savedAt', async () => {
    let resolveUpdate: (v: unknown) => void = () => {};
    updateModeMap.mockImplementation(() => new Promise(resolve => { resolveUpdate = resolve; }));
    const { result } = setup();
    vi.useFakeTimers();
    try {
      expect(result.current.saveStatus).toBe('idle');
      expect(result.current.savedAt).toBeNull();
      act(() => result.current.scheduleSave([node('a')], []));
      expect(result.current.saveStatus).toBe('pending'); // таймер ещё не сработал — «Изменения ещё не сохранены»

      await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
      expect(result.current.saveStatus).toBe('saving'); // запрос ушёл, ответа ещё нет
      expect(updateModeMap).toHaveBeenCalledTimes(1);

      await act(async () => { resolveUpdate({}); });
      expect(result.current.saveStatus).toBe('saved');
      expect(result.current.savedAt).toBeInstanceOf(Date);
    } finally {
      vi.useRealTimers();
    }
  });

  // Issue #879: раньше провал молча возвращал 'idle' — терапевт считал правку сохранённой.
  it('провал api.updateModeMap → статус error + отчёт в телеметрию; retry шлёт свежие рефы и даёт saved', async () => {
    updateModeMap.mockRejectedValueOnce(new Error('network'));
    const { result, nodesRef } = setup();
    vi.useFakeTimers();
    try {
      act(() => result.current.scheduleSave([node('a')], []));
      await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
      expect(result.current.saveStatus).toBe('error');
      expect(result.current.savedAt).toBeNull();
      expect(reportClientError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'mode map save failed', section: 'modeMap' }),
      );

      nodesRef.current = [node('a'), node('b')]; // правка после провала — повтор обязан взять её
      await act(async () => { result.current.retry(); });
      expect(updateModeMap).toHaveBeenCalledTimes(2);
      const body = updateModeMap.mock.calls[1][1] as { nodes: FlowNode[] };
      expect(body.nodes.map(n => n.id)).toEqual(['a', 'b']);
      expect(result.current.saveStatus).toBe('saved');
      expect(result.current.savedAt).toBeInstanceOf(Date);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retry при взведённом таймере отменяет его: ровно один вызов api', async () => {
    const { result } = setup();
    vi.useFakeTimers();
    try {
      act(() => result.current.scheduleSave([node('a')], []));
      await act(async () => { result.current.retry(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
      expect(updateModeMap).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useModeMapAutosave — размонтирование со взведённым таймером', () => {
  it('уход со экрана до срабатывания таймера отправляет несохранённую правку немедленно', () => {
    const { result, unmount, nodesRef, edgesRef } = setup();
    nodesRef.current = [node('a'), node('b')]; // «несохранённая» правка после scheduleSave
    act(() => result.current.scheduleSave([node('a')], []));
    expect(updateModeMap).not.toHaveBeenCalled();

    unmount();

    expect(updateModeMap).toHaveBeenCalledTimes(1);
    const body = updateModeMap.mock.calls[0][1] as { nodes: FlowNode[]; edges: FlowEdge[] };
    // Немедленное сохранение берёт САМЫЕ свежие рефы, а не аргументы последнего scheduleSave.
    expect(body.nodes.map(n => n.id)).toEqual(['a', 'b']);
    expect(body.edges).toEqual(edgesRef.current);
  });

  it('провал немедленного сохранения не вылетает необработанным отказом — репортится в телеметрию', async () => {
    updateModeMap.mockRejectedValueOnce(new Error('network'));
    const { result, unmount } = setup();
    act(() => result.current.scheduleSave([node('a')], []));

    unmount();
    await act(async () => {}); // даём reject долететь до .catch

    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'mode map unmount save failed' }),
    );
  });

  it('таймер уже сработал (сохранение прошло) — размонтирование НЕ шлёт повторный вызов', async () => {
    const { result, unmount } = setup();
    vi.useFakeTimers();
    try {
      act(() => result.current.scheduleSave([node('a')], []));
      await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
      expect(updateModeMap).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
    unmount(); // ничего не «взведено» — повторного вызова быть не должно
    expect(updateModeMap).toHaveBeenCalledTimes(1);
  });

  it('размонтирование без единой правки (scheduleSave не вызывался) ничего не отправляет', () => {
    const { unmount } = setup();
    unmount();
    expect(updateModeMap).not.toHaveBeenCalled();
  });
});
