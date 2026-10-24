// Выход из мини-аппа для веб-хоста (ярлык/вкладка). Оркестровка: сначала гасим
// сессию на сервере (кука ещё уходит с запросом), потом чистим локально и
// показываем экран входа. vi.hoisted — иначе фабрика vi.mock не увидит моки
// (она поднимается выше объявлений).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  postLogout: vi.fn(),
  clearLocalData: vi.fn(),
  clearApiCache: vi.fn(),
  clearSession: vi.fn(),
  markSessionExpired: vi.fn(),
}));

vi.mock('../../shared/src/auth/logout', () => ({ postLogout: m.postLogout }));
vi.mock('../../shared/src/auth/clearLocalData', () => ({
  clearLocalData: m.clearLocalData,
}));
vi.mock('../../shared/src/api/apiCache', () => ({
  clearApiCache: m.clearApiCache,
}));
vi.mock('./utils/apiBase', () => ({ BASE: 'https://api.test' }));
vi.mock('./session', () => ({
  clearSession: m.clearSession,
  markSessionExpired: m.markSessionExpired,
}));

import { logout } from './logout';

beforeEach(() => {
  vi.clearAllMocks();
  m.postLogout.mockResolvedValue(undefined);
});

describe('logout (мини-апп, веб-хост)', () => {
  it('гасит сессию на сервере, чистит локально и показывает экран входа', async () => {
    await logout();

    expect(m.postLogout).toHaveBeenCalledWith('https://api.test', {
      requestedWith: 'miniapp',
    });
    expect(m.clearSession).toHaveBeenCalledTimes(1);
    expect(m.clearLocalData).toHaveBeenCalledTimes(1);
    expect(m.clearApiCache).toHaveBeenCalledTimes(1);
    // markSessionExpired → App рисует LoginScreen (веб-хост).
    expect(m.markSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('серверный вызов идёт ДО локальной чистки, экран входа — последним', async () => {
    const order: string[] = [];
    m.postLogout.mockImplementation(async () => {
      order.push('server');
    });
    m.clearSession.mockImplementation(() => order.push('clearSession'));
    m.markSessionExpired.mockImplementation(() => order.push('expired'));

    await logout();

    expect(order[0]).toBe('server');
    expect(order.indexOf('server')).toBeLessThan(order.indexOf('clearSession'));
    expect(order[order.length - 1]).toBe('expired');
  });
});
