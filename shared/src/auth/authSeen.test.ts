// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { markAuthSeen, hasAuthSeen, clearAuthSeen } from './authSeen';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('отметка «этот контейнер уже входил»', () => {
  it('новичок — отметки нет', () => {
    expect(hasAuthSeen()).toBe(false);
  });

  it('после успешного входа отметка появляется', () => {
    markAuthSeen();
    expect(hasAuthSeen()).toBe(true);
  });

  it('выход снимает отметку — это не авария, а решение человека', () => {
    markAuthSeen();
    clearAuthSeen();
    expect(hasAuthSeen()).toBe(false);
  });

  it('недоступное хранилище не роняет вход, а мягко даёт «новичка»', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => markAuthSeen()).not.toThrow();
    expect(hasAuthSeen()).toBe(false);
    expect(() => clearAuthSeen()).not.toThrow();
  });
});
