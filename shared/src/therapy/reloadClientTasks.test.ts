import { describe, it, expect, vi } from 'vitest';
import { reloadClientTasks } from './reloadClientTasks';
import type { UserTask } from '../apiTypes';

const task = { id: 1 } as UserTask;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('reloadClientTasks', () => {
  it('клиент всё ещё открыт — свежие задания показываются', async () => {
    const show = vi.fn();
    const fetchTasks = vi.fn(() => Promise.resolve([task]));
    reloadClientTasks(7, () => true, fetchTasks, show);
    await flush();
    expect(fetchTasks).toHaveBeenCalledWith(7);
    expect(show).toHaveBeenCalledWith([task]);
  });

  it('открыт уже другой клиент — его список не трогается', async () => {
    const show = vi.fn();
    reloadClientTasks(
      7,
      () => false,
      () => Promise.resolve([task]),
      show,
    );
    await flush();
    expect(show).not.toHaveBeenCalled();
  });

  it('сбой перечитывания показанное не стирает', async () => {
    const show = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    reloadClientTasks(
      7,
      () => true,
      () => Promise.reject(new Error('net')),
      show,
    );
    await flush();
    expect(show).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
