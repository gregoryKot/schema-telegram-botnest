// Тесты скрытия пунктов быстрых действий (opt-out модель).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseHiddenActions,
  serializeHiddenActions,
  getHiddenActions,
  setActionHidden,
  isActionHidden,
  PLUS_ACTIONS_HIDDEN_KEY,
  TOOLS_ACTIONS_HIDDEN_KEY,
} from './quickActionPrefs';

// В node-окружении vitest нет localStorage — простой in-memory стаб (как в
// todayFocus.test.ts).
beforeEach(() => {
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

describe('parseHiddenActions', () => {
  it('null → пустой набор', () => {
    expect(parseHiddenActions(null)).toEqual([]);
  });

  it('валидный JSON-массив строк проходит', () => {
    expect(parseHiddenActions('["tracker","stop"]')).toEqual([
      'tracker',
      'stop',
    ]);
  });

  it('битый JSON → пустой набор', () => {
    expect(parseHiddenActions('{не json')).toEqual([]);
  });

  it('не-массив (объект/число) → пустой набор', () => {
    expect(parseHiddenActions('{"a":1}')).toEqual([]);
    expect(parseHiddenActions('42')).toEqual([]);
  });

  it('массив с не-строковыми элементами — не-строки отфильтрованы', () => {
    expect(parseHiddenActions('["tracker", 5, null, "stop"]')).toEqual([
      'tracker',
      'stop',
    ]);
  });
});

describe('serializeHiddenActions', () => {
  it('сериализует массив в JSON', () => {
    expect(serializeHiddenActions(['tracker', 'stop'])).toBe(
      '["tracker","stop"]',
    );
  });

  it('read-after-write: parse(serialize(x)) === x', () => {
    const ids = ['warm_words', 'breathing'];
    expect(parseHiddenActions(serializeHiddenActions(ids))).toEqual(ids);
  });
});

describe('getHiddenActions / setActionHidden — read-after-write', () => {
  it('по умолчанию всё видно (пустой набор скрытых)', () => {
    expect(getHiddenActions(PLUS_ACTIONS_HIDDEN_KEY)).toEqual([]);
  });

  it('скрытие пункта сохраняется и читается обратно', () => {
    setActionHidden(PLUS_ACTIONS_HIDDEN_KEY, 'tracker', true);
    expect(getHiddenActions(PLUS_ACTIONS_HIDDEN_KEY)).toEqual(['tracker']);
    expect(isActionHidden(PLUS_ACTIONS_HIDDEN_KEY, 'tracker')).toBe(true);
  });

  it('повторное скрытие того же id не дублирует запись', () => {
    setActionHidden(PLUS_ACTIONS_HIDDEN_KEY, 'tracker', true);
    setActionHidden(PLUS_ACTIONS_HIDDEN_KEY, 'tracker', true);
    expect(getHiddenActions(PLUS_ACTIONS_HIDDEN_KEY)).toEqual(['tracker']);
  });

  it('возврат пункта (hidden=false) убирает его из списка и очищает ключ', () => {
    setActionHidden(PLUS_ACTIONS_HIDDEN_KEY, 'tracker', true);
    setActionHidden(PLUS_ACTIONS_HIDDEN_KEY, 'tracker', false);
    expect(getHiddenActions(PLUS_ACTIONS_HIDDEN_KEY)).toEqual([]);
    expect(localStorage.getItem(PLUS_ACTIONS_HIDDEN_KEY)).toBeNull();
  });

  it('два ключа-поверхности не задевают друг друга', () => {
    setActionHidden(PLUS_ACTIONS_HIDDEN_KEY, 'tracker', true);
    setActionHidden(TOOLS_ACTIONS_HIDDEN_KEY, 'plans', true);
    expect(getHiddenActions(PLUS_ACTIONS_HIDDEN_KEY)).toEqual(['tracker']);
    expect(getHiddenActions(TOOLS_ACTIONS_HIDDEN_KEY)).toEqual(['plans']);
  });
});
