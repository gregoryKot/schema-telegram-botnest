// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearLocalData } from './clearLocalData';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('clearLocalData', () => {
  it('чистит local/session storage, сохраняя только тему и решение по кукам', () => {
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('cookie_consent', 'accepted');
    // Клинический контент, зеркалённый в localStorage — на общем устройстве
    // его обязан стереть выход (следующий человек не должен прочитать).
    localStorage.setItem('ysq_result', 'секретные ответы');
    sessionStorage.setItem('temp', '1');

    clearLocalData();

    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem('cookie_consent')).toBe('accepted');
    expect(localStorage.getItem('ysq_result')).toBeNull();
    expect(sessionStorage.getItem('temp')).toBeNull();
  });

  it('недоступное хранилище (приватный режим/квота) не роняет выход', () => {
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => clearLocalData()).not.toThrow();
  });
});
