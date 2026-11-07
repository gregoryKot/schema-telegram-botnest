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
    const s = fakeStorage({ why_seen_v1: '1', theme: 'dark' });
    expect(collectPrefs(s)).toEqual({ why_seen_v1: '1' });
    expect(collectPrefs(fakeStorage({ theme: 'dark' }))).toEqual({});
  });

  it('applyServerPrefs: пишет присланное, удаляет ключи реестра без ответа, чужие не трогает', () => {
    const s = fakeStorage({
      why_seen_v1: '1',
      quick_actions_hidden_tools: '["a"]',
      theme: 'dark',
    });
    applyServerPrefs({ why_seen_v1: '1' }, s);
    expect(s.getItem('why_seen_v1')).toBe('1');
    expect(s.getItem('quick_actions_hidden_tools')).toBeNull();
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
    const { sync, storage } = make({ why_seen_v1: '1' });
    sync.syncFromServer({});
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: { why_seen_v1: '1' },
    });
    expect(storage.getItem('why_seen_v1')).toBe('1');
    await vi.waitFor(() =>
      expect(storage.getItem('ui_prefs_migrated')).toBe('1'),
    );
  });

  it('null/undefined с локальными ключами → тоже мигрирует', () => {
    make({ why_seen_v1: '1' }).sync.syncFromServer(null);
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
    const { sync, storage } = make({ why_seen_v1: '1' });
    sync.syncFromServer({});
    await vi.waitFor(() => expect(err).toHaveBeenCalled());
    expect(storage.getItem('ui_prefs_migrated')).toBeNull();
    err.mockRestore();
  });
});

describe('syncFromServer — server wins', () => {
  it('реальные данные: применяет и НЕ пушит обратно только что применённое', () => {
    const { sync, storage } = make({ why_seen_v1: '1' });
    sync.syncFromServer({ quick_actions_order_tools: '1' });
    expect(storage.getItem('quick_actions_order_tools')).toBe('1');
    expect(storage.getItem('why_seen_v1')).toBeNull();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('уже мигрировавшее устройство: пустой ответ — это «везде очищено», стирает локальное', () => {
    const { sync, storage } = make({
      ui_prefs_migrated: '1',
      why_seen_v1: '1',
    });
    sync.syncFromServer({});
    expect(storage.getItem('why_seen_v1')).toBeNull();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe('notifyPrefsChanged — debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('серия изменений подряд схлопывается в один вызов, только после полного окна', () => {
    const { sync } = make({ why_seen_v1: '1' });
    sync.notifyPrefsChanged();
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(1499);
    expect(updateSettings).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: { why_seen_v1: '1' },
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

  // До #922 тут стояло «серверные настройки отменяют ожидающий пуш» — и
  // правка, не успевшая уйти, стиралась серверной копией: тест пинил баг.
  it('ответ сервера при ожидающем пуше не стирает правку: она уходит сразу, один раз', () => {
    const { sync, storage } = make({
      ui_prefs_migrated: '1',
      why_seen_v1: '1',
    });
    sync.notifyPrefsChanged();
    sync.syncFromServer({ quick_actions_order_tools: '1' });
    expect(storage.getItem('why_seen_v1')).toBe('1');
    expect(storage.getItem('quick_actions_order_tools')).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: { why_seen_v1: '1' },
    });
  });

  it('flush шлёт ожидающий пуш сейчас; без ожидающего — ничего', () => {
    const { sync } = make({ why_seen_v1: '1' });
    sync.flush();
    expect(updateSettings).not.toHaveBeenCalled();
    sync.notifyPrefsChanged();
    sync.flush();
    expect(updateSettings).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });
});

// #922: скрыл блоки → закрыл лист → перезагрузил раньше, чем ушёл пуш
// (окно debounce), или пуш упал → старт применял серверную копию без правки,
// и блоки возвращались. Каждый тест — «прошлая загрузка» и «следующая» на
// одном хранилище: синхронизатор новый, маркер правки — в storage.
describe('недошедшая правка переживает перезагрузку (#922)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const SERVER = { screen_order_profile: '["journey","portrait"]' };
  const HIDDEN = '["portrait","journey"]';

  function editThenReload(storage: PrefStorage, push: 'none' | 'fails') {
    const before = createUiPrefsSync({
      api: { updateSettings },
      storage,
      requireInitialSync: true,
    });
    before.syncFromServer(SERVER);
    storage.setItem('screen_hidden_profile', HIDDEN);
    before.notifyPrefsChanged();
    if (push === 'fails') vi.advanceTimersByTime(1500); // пуш ушёл и упал
    // перезагрузка: таймер прежней страницы умирает вместе с ней
    return createUiPrefsSync({
      api: { updateSettings },
      storage,
      requireInitialSync: true,
    });
  }

  it('перезагрузка до пуша: старая серверная копия не затирает правку, следующий старт её досылает', async () => {
    const storage = fakeStorage({ ui_prefs_migrated: '1' });
    const after = editThenReload(storage, 'none');
    after.syncFromServer(SERVER);
    expect(storage.getItem('screen_hidden_profile')).toBe(HIDDEN);
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: { ...SERVER, screen_hidden_profile: HIDDEN },
    });
    await vi.waitFor(() =>
      expect(storage.getItem('ui_prefs_dirty')).toBeNull(),
    );
  });

  it('пуш упал: правка остаётся отмеченной и уходит на следующем старте', async () => {
    updateSettings.mockRejectedValueOnce(new Error('offline'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const storage = fakeStorage({ ui_prefs_migrated: '1' });
    const after = editThenReload(storage, 'fails');
    await vi.waitFor(() => expect(err).toHaveBeenCalled());
    expect(storage.getItem('ui_prefs_dirty')).toBe('1');
    after.syncFromServer(SERVER);
    expect(storage.getItem('screen_hidden_profile')).toBe(HIDDEN);
    expect(updateSettings).toHaveBeenLastCalledWith({
      uiPrefs: { ...SERVER, screen_hidden_profile: HIDDEN },
    });
    err.mockRestore();
  });

  it('контроль: дошедший пуш снимает маркер — следующий старт снова server wins', async () => {
    const storage = fakeStorage({ ui_prefs_migrated: '1' });
    const sync = createUiPrefsSync({ api: { updateSettings }, storage });
    storage.setItem('screen_hidden_profile', HIDDEN);
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(1500);
    await vi.waitFor(() =>
      expect(storage.getItem('ui_prefs_dirty')).toBeNull(),
    );
    createUiPrefsSync({ api: { updateSettings }, storage }).syncFromServer({});
    expect(storage.getItem('screen_hidden_profile')).toBeNull();
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it('правка во время запроса: ответ на старый пуш маркер не снимает', async () => {
    let answer!: () => void;
    updateSettings.mockReturnValueOnce(new Promise<void>((r) => (answer = r)));
    const storage = fakeStorage({ ui_prefs_migrated: '1' });
    const sync = createUiPrefsSync({ api: { updateSettings }, storage });
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(1500);
    sync.notifyPrefsChanged(); // вторая правка, пока первый пуш в пути
    answer();
    await vi.waitFor(() =>
      expect(storage.getItem('ui_prefs_migrated')).toBe('1'),
    );
    await Promise.resolve();
    expect(storage.getItem('ui_prefs_dirty')).toBe('1');
  });

  it('правка до первого ответа на немигрировавшем устройстве уступает серверу (набор ключей неполный)', () => {
    const storage = fakeStorage();
    const sync = createUiPrefsSync({
      api: { updateSettings },
      storage,
      requireInitialSync: true,
    });
    storage.setItem('screen_hidden_profile', HIDDEN);
    sync.notifyPrefsChanged();
    sync.syncFromServer(SERVER);
    expect(storage.getItem('screen_hidden_profile')).toBeNull();
    expect(storage.getItem('ui_prefs_dirty')).toBeNull();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

// Сервер заменяет uiPrefs ЦЕЛИКОМ. Сайт с неполным набором ключей, пушнувший
// до первого ответа сервера, стёр бы настройки, сделанные в мини-аппе.
describe('requireInitialSync — не пушить до первого ответа сервера', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('запись настройки до ответа сервера не уходит на сервер', () => {
    const { sync } = make({ why_seen_v1: '1' }, true);
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(10_000);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('после ответа пуш несёт И серверные ключи, И новое изменение — чужое не стёрто', () => {
    const { sync, storage } = make({}, true);
    sync.syncFromServer({
      screen_order_profile: '["a","b"]',
      quick_actions_order_tools: '1',
    });
    storage.setItem('why_seen_v1', '1');
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(1500);
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: {
        screen_order_profile: '["a","b"]',
        quick_actions_order_tools: '1',
        why_seen_v1: '1',
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
    const { sync } = make({ why_seen_v1: '1' });
    sync.notifyPrefsChanged();
    vi.advanceTimersByTime(1500);
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });
});
