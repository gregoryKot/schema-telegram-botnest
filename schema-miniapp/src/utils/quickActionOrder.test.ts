// Тесты порядка пунктов быстрых действий (per-device, стрелки ↑/↓,
// localStorage). Модель — та же generic-по-ключу схема, что у скрытия
// (quickActionPrefs.test.ts): пустой порядок = порядок реестра, новый id
// реестра — в конец, stable.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseActionOrder,
  serializeActionOrder,
  getActionOrder,
  applyActionOrder,
  withMoveFlags,
  moveAction,
  PLUS_ACTIONS_ORDER_KEY,
  TOOLS_ACTIONS_ORDER_KEY,
} from './quickActionOrder';

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

describe('parseActionOrder', () => {
  it('null → пустой порядок', () => {
    expect(parseActionOrder(null)).toEqual([]);
  });

  it('валидный JSON-массив строк проходит', () => {
    expect(parseActionOrder('["a","b"]')).toEqual(['a', 'b']);
  });

  it('битый JSON → пустой порядок', () => {
    expect(parseActionOrder('{не json')).toEqual([]);
  });

  it('не-массив (объект/число) → пустой порядок', () => {
    expect(parseActionOrder('{"a":1}')).toEqual([]);
    expect(parseActionOrder('42')).toEqual([]);
  });

  it('не-строковые элементы отфильтрованы', () => {
    expect(parseActionOrder('["a", 5, null, "b"]')).toEqual(['a', 'b']);
  });
});

describe('serializeActionOrder / getActionOrder', () => {
  it('read-after-write: parse(serialize(x)) === x', () => {
    const ids = ['warm_words', 'breathing'];
    expect(parseActionOrder(serializeActionOrder(ids))).toEqual(ids);
  });

  it('пустой localStorage → пустой порядок', () => {
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([]);
  });
});

describe('applyActionOrder', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('пустой порядок = порядок реестра', () => {
    expect(applyActionOrder(items, [])).toEqual(items);
  });

  it('элементы из order идут первыми, в его порядке', () => {
    expect(applyActionOrder(items, ['c', 'a'])).toEqual([
      { id: 'c' },
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('id из order, которых нет в items, просто игнорируются', () => {
    expect(applyActionOrder(items, ['z', 'c'])).toEqual([
      { id: 'c' },
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('новый пункт реестра (не в order) — в конец, в исходном порядке (stable)', () => {
    const wider = [...items, { id: 'd' }];
    expect(applyActionOrder(wider, ['b'])).toEqual([
      { id: 'b' },
      { id: 'a' },
      { id: 'c' },
      { id: 'd' },
    ]);
  });
});

describe('withMoveFlags', () => {
  it('первый — disabledUp, последний — disabledDown, середина — оба false', () => {
    const flagged = withMoveFlags([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(flagged[0]).toMatchObject({
      disabledUp: true,
      disabledDown: false,
    });
    expect(flagged[1]).toMatchObject({
      disabledUp: false,
      disabledDown: false,
    });
    expect(flagged[2]).toMatchObject({
      disabledUp: false,
      disabledDown: true,
    });
  });

  it('единственный элемент — задизейблены обе стрелки', () => {
    const flagged = withMoveFlags([{ id: 'a' }]);
    expect(flagged[0]).toMatchObject({ disabledUp: true, disabledDown: true });
  });
});

describe('moveAction', () => {
  it('сдвиг вниз с пустого порядка сохраняет полный список со свопом', () => {
    const moved = moveAction(
      PLUS_ACTIONS_ORDER_KEY,
      ['a', 'b', 'c'],
      'a',
      'down',
    );
    expect(moved).toBe(true);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual(['b', 'a', 'c']);
  });

  it('сдвиг вверх', () => {
    moveAction(PLUS_ACTIONS_ORDER_KEY, ['a', 'b', 'c'], 'c', 'up');
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual(['a', 'c', 'b']);
  });

  it('край: вверх у первого — false, localStorage не тронут', () => {
    const moved = moveAction(
      PLUS_ACTIONS_ORDER_KEY,
      ['a', 'b', 'c'],
      'a',
      'up',
    );
    expect(moved).toBe(false);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([]);
  });

  it('край: вниз у последнего — false', () => {
    const moved = moveAction(
      PLUS_ACTIONS_ORDER_KEY,
      ['a', 'b', 'c'],
      'c',
      'down',
    );
    expect(moved).toBe(false);
  });

  it('id не среди siblings — false, no-op', () => {
    expect(moveAction(PLUS_ACTIONS_ORDER_KEY, ['a', 'b'], 'z', 'up')).toBe(
      false,
    );
  });

  it('read-after-write: повторный вызов двигает дальше от уже сохранённого', () => {
    moveAction(PLUS_ACTIONS_ORDER_KEY, ['a', 'b', 'c'], 'c', 'up'); // a c b
    moveAction(PLUS_ACTIONS_ORDER_KEY, ['a', 'c', 'b'], 'c', 'up'); // c a b
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual(['c', 'a', 'b']);
  });

  it('свопнутый блок встаёт на место первого вхождения siblings, остальные id не двигаются', () => {
    localStorage.setItem(
      PLUS_ACTIONS_ORDER_KEY,
      serializeActionOrder(['x', 'a', 'y', 'b', 'z']),
    );
    moveAction(PLUS_ACTIONS_ORDER_KEY, ['a', 'b'], 'a', 'down');
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([
      'x',
      'b',
      'a',
      'y',
      'z',
    ]);
  });

  it('siblings, ранее не встречавшиеся в порядке, встают в хвост', () => {
    localStorage.setItem(
      PLUS_ACTIONS_ORDER_KEY,
      serializeActionOrder(['x', 'y']),
    );
    const moved = moveAction(PLUS_ACTIONS_ORDER_KEY, ['a', 'b'], 'b', 'up');
    expect(moved).toBe(true);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([
      'x',
      'y',
      'b',
      'a',
    ]);
  });

  it('два ключа-поверхности не задевают друг друга', () => {
    moveAction(PLUS_ACTIONS_ORDER_KEY, ['a', 'b'], 'b', 'up');
    moveAction(TOOLS_ACTIONS_ORDER_KEY, ['p', 'q'], 'q', 'up');
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual(['b', 'a']);
    expect(getActionOrder(TOOLS_ACTIONS_ORDER_KEY)).toEqual(['q', 'p']);
  });
});
