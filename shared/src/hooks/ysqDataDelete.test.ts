// @vitest-environment jsdom
// Удаление всех данных теста схем (кнопка в настройках обоих фронтендов,
// решение владельца 2026-10-22). Главное — порядок: локальные ключи уходят
// только после ответа сервера, при отказе остаются, а ошибка доходит до
// экрана (раньше мини-апп чистил их до запроса и говорил «удалено»).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  buildYsqDataDeleteCopy,
  deleteAllYsqData,
  hasLocalYsqData,
  useYsqDataDelete,
} from './ysqDataDelete';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from './ysqStorageKeys';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(YSQ_RESULT_KEY, '{"answers":[1]}');
  localStorage.setItem(YSQ_PROGRESS_KEY, '{"page":2}');
  localStorage.setItem('app_theme', 'dark');
});

describe('deleteAllYsqData', () => {
  it('успех: зовёт DELETE /api/ysq-data и только потом чистит оба ключа теста', async () => {
    let keysAtRequest: (string | null)[] = [];
    const api = {
      deleteYsqData: vi.fn(async () => {
        keysAtRequest = [
          localStorage.getItem(YSQ_RESULT_KEY),
          localStorage.getItem(YSQ_PROGRESS_KEY),
        ];
      }),
    };

    await deleteAllYsqData(api);

    expect(api.deleteYsqData).toHaveBeenCalledTimes(1);
    // Пока запрос летел, локальные данные были на месте.
    expect(keysAtRequest.every((v) => v !== null)).toBe(true);
    expect(localStorage.getItem(YSQ_RESULT_KEY)).toBeNull();
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).toBeNull();
    // Чужие ключи не трогаем.
    expect(localStorage.getItem('app_theme')).toBe('dark');
  });

  it('ошибка сервера: ключи на месте, ошибка проброшена', async () => {
    const api = {
      deleteYsqData: vi.fn().mockRejectedValue(new Error('network down')),
    };

    await expect(deleteAllYsqData(api)).rejects.toThrow('network down');

    expect(localStorage.getItem(YSQ_RESULT_KEY)).not.toBeNull();
    expect(localStorage.getItem(YSQ_PROGRESS_KEY)).not.toBeNull();
  });
});

describe('useYsqDataDelete — спросили → удалили или показали ошибку', () => {
  function setup(deleteYsqData: () => Promise<unknown>) {
    const api = { deleteYsqData: vi.fn(deleteYsqData) };
    const onDeleted = vi.fn();
    const hook = renderHook(() => useYsqDataDelete(api, onDeleted));
    return { api, onDeleted, hook };
  }

  it('ask открывает подтверждение и ничего не удаляет; cancel закрывает', () => {
    const { api, hook } = setup(async () => undefined);
    act(() => hook.result.current.ask());
    expect(hook.result.current.confirming).toBe(true);
    act(() => hook.result.current.cancel());
    expect(hook.result.current.confirming).toBe(false);
    expect(api.deleteYsqData).not.toHaveBeenCalled();
    expect(localStorage.getItem(YSQ_RESULT_KEY)).not.toBeNull();
  });

  it('confirm успешен: запрос, ключи очищены, подтверждение закрыто, onDeleted вызван', async () => {
    const { api, onDeleted, hook } = setup(async () => undefined);
    act(() => hook.result.current.ask());
    await act(() => hook.result.current.confirm());

    expect(api.deleteYsqData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(YSQ_RESULT_KEY)).toBeNull();
    expect(hook.result.current).toMatchObject({
      confirming: false,
      busy: false,
      failed: false,
    });
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('confirm с ошибкой: подтверждение открыто с ошибкой, ключи на месте, onDeleted нет', async () => {
    const { onDeleted, hook } = setup(() => Promise.reject(new Error('500')));
    act(() => hook.result.current.ask());
    await act(() => hook.result.current.confirm());

    expect(hook.result.current).toMatchObject({
      confirming: true,
      busy: false,
      failed: true,
    });
    expect(localStorage.getItem(YSQ_RESULT_KEY)).not.toBeNull();
    expect(onDeleted).not.toHaveBeenCalled();

    // Повторный заход начинается без старой ошибки.
    act(() => hook.result.current.cancel());
    act(() => hook.result.current.ask());
    expect(hook.result.current.failed).toBe(false);
  });
});

describe('hasLocalYsqData', () => {
  it('есть итог или прогресс — true, нет ни того ни другого — false', () => {
    expect(hasLocalYsqData()).toBe(true);
    localStorage.removeItem(YSQ_RESULT_KEY);
    expect(hasLocalYsqData()).toBe(true);
    localStorage.removeItem(YSQ_PROGRESS_KEY);
    expect(hasLocalYsqData()).toBe(false);
  });
});

describe('buildYsqDataDeleteCopy', () => {
  it('текст ошибки — в форме обращения, остальное безлично и одинаково', () => {
    const tyCopy = buildYsqDataDeleteCopy(ty);
    const vyCopy = buildYsqDataDeleteCopy(vy);
    expect(tyCopy.error).toBe('Не удалось удалить. Попробуй ещё раз');
    expect(vyCopy.error).toBe('Не удалось удалить. Попробуйте ещё раз');
    expect({ ...tyCopy, error: '' }).toEqual({ ...vyCopy, error: '' });
  });
});
