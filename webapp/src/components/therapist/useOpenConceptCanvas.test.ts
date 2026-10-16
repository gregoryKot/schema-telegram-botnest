// @vitest-environment jsdom
// useOpenConceptCanvas — то, что не видно через вкладку: название карты и
// поведение без клиента. Основной путь (create → update → событие → переход) и
// отказы проверены на всей вкладке в ClientConceptTab.canvas.test.tsx.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: { createModeMap: vi.fn(), updateModeMap: vi.fn(), deleteModeMap: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { CONCEPT_CANVAS_OPEN_EVENT } from '../../../../shared/src/share/analytics';
import { canvasMapTitle, useOpenConceptCanvas } from './useOpenConceptCanvas';

describe('canvasMapTitle', () => {
  it('«Схема случая · день месяц.» — день создания, месяц сокращённо', () => {
    expect(canvasMapTitle(new Date('2026-10-15T12:00:00Z'))).toBe('Схема случая · 15 окт.');
    expect(canvasMapTitle(new Date('2026-03-02T12:00:00Z'))).toBe('Схема случая · 2 мар.');
  });
});

describe('useOpenConceptCanvas', () => {
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
