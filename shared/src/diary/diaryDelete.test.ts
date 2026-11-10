// @vitest-environment jsdom
// QA клиента 2026-11, З2: удаление записи дневника — 404 считается успехом,
// любой другой сбой виден, повторное нажатие во время запроса ничего не шлёт.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { deleteDiaryEntry, useDeleteAction } from './diaryDelete';

const httpError = (status: number) =>
  Object.assign(new Error('API error'), { status });

function makeApi() {
  return {
    deleteSchemaDiary: vi.fn().mockResolvedValue(undefined),
    deleteModeDiary: vi.fn().mockResolvedValue(undefined),
    deleteGratitudeDiary: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
  };
}

describe('deleteDiaryEntry', () => {
  it('зовёт метод своего дневника', async () => {
    const api = makeApi();
    await deleteDiaryEntry(api, 'schema', 1);
    await deleteDiaryEntry(api, 'mode', 2);
    await deleteDiaryEntry(api, 'gratitude', 3);
    expect(api.deleteSchemaDiary).toHaveBeenCalledWith(1);
    expect(api.deleteModeDiary).toHaveBeenCalledWith(2);
    expect(api.deleteGratitudeDiary).toHaveBeenCalledWith(3);
  });

  // Правило №8: удаление записи дневника видно в /stats (2026-11).
  it('успешное удаление шлёт entry_deleted с типом diary', async () => {
    const api = makeApi();
    await deleteDiaryEntry(api, 'gratitude', 3);
    expect(api.trackEvent).toHaveBeenCalledWith('entry_deleted', {
      type: 'diary',
    });
  });

  it('404 — записи уже нет, это успех; удалял не этот запрос — события нет', async () => {
    const api = makeApi();
    api.deleteModeDiary.mockRejectedValue(httpError(404));
    await expect(deleteDiaryEntry(api, 'mode', 2)).resolves.toBeUndefined();
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it('500 и обрыв сети пробрасываются — экран должен о них сказать', async () => {
    const api = makeApi();
    api.deleteModeDiary.mockRejectedValue(httpError(500));
    await expect(deleteDiaryEntry(api, 'mode', 2)).rejects.toThrow();
    api.deleteSchemaDiary.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(deleteDiaryEntry(api, 'schema', 1)).rejects.toThrow();
    expect(api.trackEvent).not.toHaveBeenCalled();
  });
});

describe('useDeleteAction', () => {
  it('сбой — failed, повтор сбрасывает его', async () => {
    const onDelete = vi
      .fn()
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteAction(onDelete));
    await act(() => result.current.run());
    expect(result.current.failed).toBe(true);
    expect(result.current.busy).toBe(false);
    await act(() => result.current.run());
    expect(result.current.failed).toBe(false);
  });

  it('два нажатия, пока запрос идёт, — один вызов', async () => {
    let resolve!: () => void;
    const onDelete = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => useDeleteAction(onDelete));
    let first!: Promise<void>;
    act(() => {
      first = result.current.run();
      void result.current.run();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
    await act(async () => {
      resolve();
      await first;
    });
    expect(result.current.busy).toBe(false);
  });
});
