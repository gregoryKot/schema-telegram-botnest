// @vitest-environment jsdom
// useOpenConceptCanvas — то, что не видно через вкладку: название карты, её тип
// и поведение без клиента. Основной путь (create → update → событие → переход) и
// отказы проверены на всей вкладке в ClientConceptTab.canvas.test.tsx.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: { listModeMaps: vi.fn(), createModeMap: vi.fn(), updateModeMap: vi.fn(), deleteModeMap: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { CONCEPT_CANVAS_OPEN_EVENT } from '../../../../shared/src/share/analytics';
import { conceptMapTitle } from '../modeMap/mapKinds';
import { useOpenConceptCanvas } from './useOpenConceptCanvas';

// Заголовок и номер дня — mapKinds.test.ts, сборка и уборка — createConceptMap.test.ts.
describe('useOpenConceptCanvas', () => {
  it('вторая карта за день создаётся с номером, а не с тем же именем', async () => {
    const today = conceptMapTitle();
    vi.mocked(api.listModeMaps).mockResolvedValue([{ id: 1, title: today, kind: 'personality', createdAt: '', updatedAt: '' }]);
    vi.mocked(api.createModeMap).mockResolvedValue({ id: 10 } as never);
    vi.mocked(api.updateModeMap).mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useOpenConceptCanvas({ clientId: 3, source: { modeIds: [], schemaIds: [], modeLinks: [], schemaLinks: [] }, onOpened: vi.fn() }),
    );
    await act(async () => { await result.current.open(); });
    expect(vi.mocked(api.createModeMap).mock.calls.at(-1)).toEqual([3, `${today} (2)`, 'concept']);
  });

  it('отказ записи фигур — failed, пустая карта удаляется, переход не случается', async () => {
    vi.mocked(api.listModeMaps).mockResolvedValue([]);
    vi.mocked(api.createModeMap).mockResolvedValue({ id: 12 } as never);
    vi.mocked(api.updateModeMap).mockRejectedValue(new Error('500'));
    vi.mocked(api.deleteModeMap).mockResolvedValue(undefined as never);
    const onOpened = vi.fn();
    const { result } = renderHook(() =>
      useOpenConceptCanvas({ clientId: 3, source: { modeIds: [], schemaIds: [], modeLinks: [], schemaLinks: [] }, onOpened }),
    );
    await act(async () => { await result.current.open(); });
    expect(result.current).toMatchObject({ busy: false, failed: true });
    expect(api.deleteModeMap).toHaveBeenCalledWith(12);
    expect(onOpened).not.toHaveBeenCalled();
  });

  it('список карт не загрузился — карта всё равно создаётся (имя без номера)', async () => {
    vi.mocked(api.listModeMaps).mockRejectedValue(new Error('500'));
    vi.mocked(api.createModeMap).mockResolvedValue({ id: 11 } as never);
    vi.mocked(api.updateModeMap).mockResolvedValue({} as never);
    const onOpened = vi.fn();
    const { result } = renderHook(() =>
      useOpenConceptCanvas({ clientId: 3, source: { modeIds: [], schemaIds: [], modeLinks: [], schemaLinks: [] }, onOpened }),
    );
    await act(async () => { await result.current.open(); });
    expect(vi.mocked(api.createModeMap).mock.calls.at(-1)![1]).toBe(conceptMapTitle());
    expect(onOpened).toHaveBeenCalledWith(11);
  });

  it('без клиента ничего не создаёт и не показывает отказ', async () => {
    const onOpened = vi.fn();
    const { result } = renderHook(() =>
      useOpenConceptCanvas({
        clientId: undefined,
        source: { modeIds: [], schemaIds: [], modeLinks: [], schemaLinks: [] },
        onOpened,
      }),
    );
    await act(async () => { await result.current.open(); });
    expect(api.createModeMap).not.toHaveBeenCalled();
    expect(onOpened).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ busy: false, failed: false });
  });

  it('пустая схема тоже переносится: колесо потребностей без рёбер', async () => {
    vi.mocked(api.createModeMap).mockResolvedValue({ id: 9 } as never);
    vi.mocked(api.updateModeMap).mockResolvedValue({} as never);
    const onOpened = vi.fn();
    const { result } = renderHook(() =>
      useOpenConceptCanvas({
        clientId: 3,
        source: { modeIds: [], schemaIds: [], modeLinks: [], schemaLinks: [] },
        onOpened,
      }),
    );
    await act(async () => { await result.current.open(); });
    const body = vi.mocked(api.updateModeMap).mock.calls[0][1] as { nodes: { type: string }[]; edges: unknown[] };
    expect(body.nodes.map((n) => n.type)).toEqual(['needs']); // колесо: потребности — его секторы, не таблетки
    expect(body.edges).toEqual([]);
    expect(onOpened).toHaveBeenCalledWith(9);
    // литерал в хуке (его видит трипваер analytics-sync) и константа не разъезжаются
    expect(api.trackEvent).toHaveBeenCalledWith(CONCEPT_CANVAS_OPEN_EVENT);
  });
});
