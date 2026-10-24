// Синхронизация настроек экранов между устройствами и площадками. Хранилище и
// api — фейки: так проверяется сам синхронизатор, а не localStorage браузера.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SYNCED_PREF_KEYS,
  collectPrefs,
  applyServerPrefs,
  createUiPrefsSync,
  type PrefStorage,
  type UiPrefsSync,
} from './uiPrefsSync';

function fakeStorage(initial: Record<string, string> = {}): PrefStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

const updateSettings = vi.fn();
beforeEach(() => {
  updateSettings.mockReset();
  updateSettings.mockResolvedValue(undefined);
});

function make(
  initial: Record<string, string> = {},
  requireInitialSync = false,
): { sync: UiPrefsSync; storage: PrefStorage } {
  const storage = fakeStorage(initial);
  return {
    storage,
    sync: createUiPrefsSync({
      api: { updateSettings },
      storage,
      requireInitialSync,
    }),
  };
}

describe('collectPrefs / applyServerPrefs', () => {
  it('collectPrefs: только присутствующие ключи реестра, чужие игнорирует', () => {
    const s = fakeStorage({ today_streak_hidden: '1', theme: 'dark' });
    expect(collectPrefs(s)).toEqual({ today_streak_hidden: '1' });
    expect(collectPrefs(fakeStorage({ theme: 'dark' }))).toEqual({});
  });

  it('applyServerPrefs: пишет присланное, удаляет ключи реестра без ответа, чужие не трогает', () => {
    const s = fakeStorage({
      today_streak_hidden: '1',
      quick_actions_hidden_plus: '["a"]',
      theme: 'dark',
    });
    applyServerPrefs({ today_streak_hidden: '1' }, s);
    expect(s.getItem('today_streak_hidden')).toBe('1');
    expect(s.getItem('quick_actions_hidden_plus')).toBeNull();
    expect(s.getItem('theme')).toBe('dark');
  });

  it('пустой ответ удаляет все ключи реестра', () => {
    const s = fakeStorage(
      Object.fromEntries(SYNCED_PREF_KEYS.map((k) => [k, '1'])),
    );
    applyServerPrefs({}, s);
    for (const k of SYNCED_PREF_KEYS) expect(s.getItem(k)).toBeNull();
  });
});

describe('syncFromServer — первичная миграция (устройство не мигрировало)', () => {
  it('реальный контракт бэка — {} (НЕ null), локальные ключи есть → мигрирует, не стирает', async () => {
    const { sync, storage } = make({ today_streak_hidden: '1' });
    sync.syncFromServer({});
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: { today_streak_hidden: '1' },
    });
    expect(storage.getItem('today_streak_hidden')).toBe('1');
    await vi.waitFor(() =>
      expect(storage.getItem('ui_prefs_migrated')).toBe('1'),
    );
  });

  it('null/undefined с локальными ключами → тоже мигрирует', () => {
    make({ today_streak_hidden: '1' }).sync.syncFromServer(null);
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it('локально пусто → пуша нет, устройство сразу отмечено мигрировавшим', () => {
    const { sync, storage } = make();
    sync.syncFromServer(undefined);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(storage.getItem('ui_prefs_migrated')).toBe('1');
  });

  it('провал пуша миграции не отмечает устройство: следующая загрузка повторит', async () => {
    updateSettings.mockRejectedValueOnce(new Error('offline'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { sync, storage } = make({ today_streak_hidden: '1' });
    sync.syncFromServer({});
    await vi.waitFor(() => expect(err).toHaveBeenCalled());
    expect(storage.getItem('ui_prefs_migrated')).toBeNull();
    err.mockRestore();
  });
});

describe('syncFromServer — server wins', () => {
  it('реальные данные: применяет и НЕ пушит обратно только что применённое', () => {
    const { sync, storage } = make({ today_streak_hidden: '1' });
    sync.syncFromServer({ today_phrase_hidden: '1' });
    expect(storage.getItem('today_phrase_hidden')).toBe('1');
    expect(storage.getItem('today_streak_hidden')).toBeNull();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('уже мигрировавшее устройство: пустой ответ — это «везде очищено», стирает локальное', () => {
    const { sync, storage } = make({
      ui_prefs_migrated: '1',
      today_streak_hidden: '1',
    });
    sync.syncFromServer({});
    expect(storage.getItem('today_streak_hidden')).toBeNull();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe('notifyPrefsChanged — debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('серия изменений подряд схлопывается в один вызов, только после полного окна', () => {
    const { sync } = make({ today_streak_hidden: '1' });
    sync.notifyPrefsChanged();
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(1499);
    expect(updateSettings).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: { today_streak_hidden: '1' },
    });
  });

  it('синхронный отказ api не ломает UI', () => {
    updateSettings.mockImplementationOnce(() => {
      throw new Error('sync boom');
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { sync } = make();
    sync.notifyPrefsChanged();
    expect(() => vi.advanceTimersByTime(1500)).not.toThrow();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('серверные настройки отменяют ожидающий пуш', () => {
    const { sync, storage } = make({
      ui_prefs_migrated: '1',
      today_streak_hidden: '1',
    });
    sync.notifyPrefsChanged();
    sync.syncFromServer({ today_phrase_hidden: '1' });
    vi.advanceTimersByTime(5000);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(storage.getItem('today_streak_hidden')).toBeNull();
  });
});

// Сервер заменяет uiPrefs ЦЕЛИКОМ. Сайт с неполным набором ключей, пушнувший
// до первого ответа сервера, стёр бы настройки, сделанные в мини-аппе.
describe('requireInitialSync — не пушить до первого ответа сервера', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('запись настройки до ответа сервера не уходит на сервер', () => {
    const { sync } = make({ today_streak_hidden: '1' }, true);
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(10_000);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('после ответа пуш несёт И серверные ключи, И новое изменение — чужое не стёрто', () => {
    const { sync, storage } = make({}, true);
    sync.syncFromServer({
      screen_order_profile: '["a","b"]',
      today_phrase_hidden: '1',
    });
    storage.setItem('today_streak_hidden', '1');
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(1500);
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: {
        screen_order_profile: '["a","b"]',
        today_phrase_hidden: '1',
        today_streak_hidden: '1',
      },
    });
  });

  it('reset закрывает пуш снова и снимает отложенный (другой пользователь в той же вкладке)', () => {
    const { sync } = make({ ui_prefs_migrated: '1' }, true);
    sync.syncFromServer({});
    sync.notifyPrefsChanged();
    sync.reset();
    vi.advanceTimersByTime(10_000);
    expect(updateSettings).not.toHaveBeenCalled();
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(10_000);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('без requireInitialSync пуш открыт сразу (поведение мини-аппа)', () => {
    const { sync } = make({ today_streak_hidden: '1' });
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(1500);
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });
});
