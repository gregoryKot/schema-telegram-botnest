// Перечитать-не-стирая: примитив для рефетча после уже удавшегося действия.
// Регрессия на баг обоих кабинетов терапевта — сбой рефетча после назначения
// задачи обнулял видимый список (`.catch(() => [])`).
import { describe, it, expect, vi } from 'vitest';
import { reloadKeepingShown } from './reloadKeepingShown';

describe('reloadKeepingShown', () => {
  it('успех — свежие данные показаны', async () => {
    const show = vi.fn();
    await reloadKeepingShown(() => Promise.resolve(['a', 'b']), show);
    expect(show).toHaveBeenCalledWith(['a', 'b']);
  });

  it('сбой — show не вызывается, показанное остаётся как было', async () => {
    const show = vi.fn();
    await reloadKeepingShown(() => Promise.reject(new Error('offline')), show);
    expect(show).not.toHaveBeenCalled();
  });

  it('пустой список — это данные, а не сбой: показывается', async () => {
    const show = vi.fn();
    await reloadKeepingShown(() => Promise.resolve([]), show);
    expect(show).toHaveBeenCalledWith([]);
  });
});
