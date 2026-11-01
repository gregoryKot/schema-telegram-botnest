// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useClientConcept } from './useClientConcept';

const getConceptualization = vi.fn();
vi.mock('../../api', () => ({ api: { getConceptualization: (...a: unknown[]) => getConceptualization(...a) } }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('useClientConcept', () => {
  it('грузит схемы, режимы и нормализованные связи один раз', async () => {
    getConceptualization.mockResolvedValue({
      schemaIds: ['abandonment'], modeIds: ['vulnerable_child'],
      modeLinks: [{ modeId: 'vulnerable_child', schemaIds: ['abandonment'] }, { alias: 'без modeId' }],
    });
    const { result } = renderHook(() => useClientConcept(7));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({ schemaIds: ['abandonment'], modeIds: ['vulnerable_child'] });
    expect((result.current as { modeLinks: unknown[] }).modeLinks).toHaveLength(1);
    expect(getConceptualization).toHaveBeenCalledTimes(1);
  });

  it('концептуализации нет (null) — пустые списки, а не сбой', async () => {
    getConceptualization.mockResolvedValue(null);
    const { result } = renderHook(() => useClientConcept(7));
    await waitFor(() => expect(result.current).toEqual({ schemaIds: [], modeIds: [], modeLinks: [] }));
  });

  it('сбой запроса — «failed», не пустой список', async () => {
    getConceptualization.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useClientConcept(7));
    await waitFor(() => expect(result.current).toBe('failed'));
  });

  it('без clientId запрос не уходит', () => {
    const { result } = renderHook(() => useClientConcept(null));
    expect(result.current).toBeNull();
    expect(getConceptualization).not.toHaveBeenCalled();
  });

  it('смена клиента не показывает данные прежнего', async () => {
    getConceptualization.mockResolvedValueOnce({ schemaIds: ['abandonment'] }).mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = renderHook(({ id }) => useClientConcept(id), { initialProps: { id: 1 } });
    await waitFor(() => expect(result.current).not.toBeNull());
    rerender({ id: 2 });
    expect(result.current).toBeNull();
  });
});
