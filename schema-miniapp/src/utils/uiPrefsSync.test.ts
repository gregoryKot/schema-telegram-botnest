// Подключение мини-аппа к общему синхронизатору настроек. Логика (миграция,
// server wins, debounce) под тестами в shared/src/prefs/uiPrefsSync.test.ts —
// здесь только то, что принадлежит мини-аппу: его api и localStorage.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SYNCED_PREF_KEYS,
  notifyPrefsChanged,
  syncFromServer,
} from './uiPrefsSync';

vi.mock('../api', () => ({
  api: { updateSettings: vi.fn().mockResolvedValue(undefined) },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// В node-окружении vitest нет localStorage — стаб, как в todayFocus.test.ts.
beforeEach(() => {
  vi.clearAllMocks();
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
});

describe('мини-апп: подключение синхронизатора', () => {
  it('реестр ключей — 15 ключей контракта с бэкендом', () => {
    expect(SYNCED_PREF_KEYS).toHaveLength(15);
  });

  it('первая миграция: пустой ответ сервера и локальные ключи → уходят через api мини-аппа', async () => {
    localStorage.setItem('today_streak_hidden', '1');
    syncFromServer({});
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      uiPrefs: { today_streak_hidden: '1' },
    });
    await vi.waitFor(() =>
      expect(localStorage.getItem('ui_prefs_migrated')).toBe('1'),
    );
  });

  it('server wins: присланное применяется в localStorage и не уходит обратно', () => {
    localStorage.setItem('today_streak_hidden', '1');
    syncFromServer({ today_phrase_hidden: '1' });
    expect(localStorage.getItem('today_phrase_hidden')).toBe('1');
    expect(localStorage.getItem('today_streak_hidden')).toBeNull();
    expect(mockApi.updateSettings).not.toHaveBeenCalled();
  });

  describe('debounce-пуш', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('мини-апп пушит и без стартового ответа (поведение не менялось)', () => {
      localStorage.setItem('today_streak_hidden', '1');
      notifyPrefsChanged();
      notifyPrefsChanged();
      vi.advanceTimersByTime(1500);
      expect(mockApi.updateSettings).toHaveBeenCalledTimes(1);
      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        uiPrefs: { today_streak_hidden: '1' },
      });
    });
  });
});
