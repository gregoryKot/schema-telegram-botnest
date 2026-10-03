// @vitest-environment jsdom
// Аудит 2026-10, E1: сервер ответил «карточки нет» — локальная копия не
// должна подмешиваться (после смены аккаунта это текст прежнего пользователя,
// который автосохранение записало бы в аккаунт нового).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadIntroSheetData } from './introSheetLoad';

const KEY = 'mode_intro_test';
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('loadIntroSheetData', () => {
  it('сервер вернул карточку → она', async () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 'локальное' }));
    expect(await loadIntroSheetData(KEY, async () => ({ a: 'серверное' }))).toEqual({
      a: 'серверное',
    });
  });

  it('сервер вернул null → null, локальный ключ удалён', async () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 'чужой текст' }));
    expect(await loadIntroSheetData(KEY, async () => null)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ошибка сети → фолбэк на локальную копию, ключ остаётся', async () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 'локальное' }));
    const fail = () => Promise.reject(new Error('offline'));
    expect(await loadIntroSheetData(KEY, fail)).toEqual({ a: 'локальное' });
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('ошибка сети и пустой/битый локальный ключ → null', async () => {
    const fail = () => Promise.reject(new Error('offline'));
    expect(await loadIntroSheetData(KEY, fail)).toBeNull();
    localStorage.setItem(KEY, '{битый');
    expect(await loadIntroSheetData(KEY, fail)).toBeNull();
  });
});
