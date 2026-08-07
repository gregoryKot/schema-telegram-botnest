// Тесты синхронизации настроек кастомизации между устройствами.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SYNCED_PREF_KEYS,
  collectPrefs,
  applyServerPrefs,
  notifyPrefsChanged,
  syncFromServer,
  type PrefStorage,
} from './uiPrefsSync';

vi.mock('../api', () => ({
  api: { updateSettings: vi.fn().mockResolvedValue(undefined) },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function fakeStorage(initial: Record<string, string> = {}): PrefStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

// В node-окружении vitest нет localStorage — стаб как в todayFocus.test.ts
// (нужен pushNow/syncFromServer — они читают/пишут глобальный localStorage).
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

describe('collectPrefs', () => {
  it('только присутствующие ключи реестра, чужие игнорирует', () => {
    const s = fakeStorage({ today_streak_hidden: '1', theme: 'dark' });
    expect(collectPrefs(s)).toEqual({ today_streak_hidden: '1' });
  });

  it('ни одного ключа реестра — пустой объект', () => {
    expect(collectPrefs(fakeStorage({ theme: 'dark' }))).toEqual({});
  });
});

describe('applyServerPrefs', () => {
  it('пишет присланные значения (server wins)', () => {
    const s = fakeStorage();
    applyServerPrefs({ today_streak_hidden: '1' }, s);
    expect(s.getItem('today_streak_hidden')).toBe('1');
  });

  it('удаляет ключи реестра, отсутствующие в ответе', () => {
    const s = fakeStorage({
      today_streak_hidden: '1',
      quick_actions_hidden_plus: '["a"]',
    });
    applyServerPrefs({ today_streak_hidden: '1' }, s);
    expect(s.getItem('quick_actions_hidden_plus')).toBeNull();
  });

  it('не трогает ключи localStorage вне реестра', () => {
    const s = fakeStorage({ theme: 'dark' });
    applyServerPrefs({}, s);
    expect(s.getItem('theme')).toBe('dark');
  });

  it('пустой ответ удаляет все ключи реестра', () => {
    const initial = Object.fromEntries(SYNCED_PREF_KEYS.map((k) => [k, '1']));
    const s = fakeStorage(initial);
    applyServerPrefs({}, s);
    for (const k of SYNCED_PREF_KEYS) expect(s.getItem(k)).toBeNull();
  });
});

describe('syncFromServer — первичная миграция (сервер null/undefined)', () => {
  it('есть локальные ключи реестра → немедленный push', () => {
    localStorage.setItem('today_streak_hidden', '1');
    syncFromServer(null);
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      uiPrefs: { today_streak_hidden: '1' },
    });
  });

  it('локально пусто → пуша нет', () => {
    syncFromServer(undefined);
    expect(mockApi.updateSettings).not.toHaveBeenCalled();
  });
});

describe('syncFromServer — сервер прислал объект (server wins)', () => {
  it('применяет присланное и НЕ пушит обратно только что применённое', () => {
    localStorage.setItem('today_streak_hidden', '1');
    syncFromServer({ today_phrase_hidden: '1' });
    expect(localStorage.getItem('today_phrase_hidden')).toBe('1');
    expect(localStorage.getItem('today_streak_hidden')).toBeNull();
    expect(mockApi.updateSettings).not.toHaveBeenCalled();
  });
});

describe('notifyPrefsChanged — debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('серия изменений подряд схлопывается в один вызов', () => {
    notifyPrefsChanged();
    notifyPrefsChanged();
    notifyPrefsChanged();
    vi.advanceTimersByTime(1500);
    expect(mockApi.updateSettings).toHaveBeenCalledTimes(1);
  });

  it('пуш срабатывает только после полного окна debounce', () => {
    localStorage.setItem('today_streak_hidden', '1');
    notifyPrefsChanged();
    vi.advanceTimersByTime(1499);
    expect(mockApi.updateSettings).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      uiPrefs: { today_streak_hidden: '1' },
    });
  });
});
