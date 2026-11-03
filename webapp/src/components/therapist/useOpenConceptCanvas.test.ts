// @vitest-environment jsdom
// useOpenConceptCanvas — то, что не видно через вкладку: название карты и
// поведение без клиента. Основной путь (create → update → событие → переход) и
// отказы проверены на всей вкладке в ClientConceptTab.canvas.test.tsx.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: { listModeMaps: vi.fn(), createModeMap: vi.fn(), updateModeMap: vi.fn(), deleteModeMap: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { CONCEPT_CANVAS_OPEN_EVENT } from '../../../../shared/src/share/analytics';
import { canvasMapTitle, distinctTitle, useOpenConceptCanvas } from './useOpenConceptCanvas';

describe('canvasMapTitle', () => {
  it('«Схема случая · день месяц.» — день создания, месяц сокращённо', () => {
    expect(canvasMapTitle(new Date('2026-10-15T12:00:00Z'))).toBe('Схема случая · 15 окт.');
    expect(canvasMapTitle(new Date('2026-03-02T12:00:00Z'))).toBe('Схема случая · 2 мар.');
  });
});

describe('distinctTitle — снимки одного дня различимы (QA 2026-10-26)', () => {
  const base = 'Схема случая · 27 окт.';
  it('первой карте дня — имя без номера', () => {
    expect(distinctTitle(base, ['Карта личности'])).toBe(base);
  });
  it('повтор — следующий свободный номер', () => {
    expect(distinctTitle(base, [base])).toBe(`${base} (2)`);
    expect(distinctTitle(base, [base, `${base} (2)`, `${base} (3)`])).toBe(`${base} (4)`);
  });
});

describe('useOpenConceptCanvas', () => {
  it('вторая карта за день создаётся с номером, а не с тем же именем', async () => {
    const today = canvasMapTitle();
    vi.mocked(api.listModeMaps).mockResolvedValue([{ id: 1, title: today, kind: 'personality', createdAt: '', updatedAt: '' }]);
    vi.mocked(api.createModeMap).mockResolvedValue({ id: 10 } as never);
    vi.mocked(api.updateModeMap).mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useOpenConceptCanvas({ clientId: 3, source: { modeIds: [], schemaIds: [], modeLinks: [], schemaLinks: [] }, onOpened: vi.fn() }),
    );
    await act(async () => { await result.current.open(); });
    expect(vi.mocked(api.createModeMap).mock.calls.at(-1)![1]).toBe(`${today} (2)`);
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
    expect(vi.mocked(api.createModeMap).mock.calls.at(-1)![1]).toBe(canvasMapTitle());
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

  it('пустая схема тоже переносится: круг и пять потребностей без рёбер', async () => {
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
    expect(body.nodes.map((n) => n.type).sort()).toEqual(['need', 'need', 'need', 'need', 'need', 'needs']);
    expect(body.edges).toEqual([]);
    expect(onOpened).toHaveBeenCalledWith(9);
    // литерал в хуке (его видит трипваер analytics-sync) и константа не разъезжаются
    expect(api.trackEvent).toHaveBeenCalledWith(CONCEPT_CANVAS_OPEN_EVENT);
  });
});
