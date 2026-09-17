// Тесты порядка пунктов быстрых действий (per-device, drag/клавиатура,
// localStorage). Модель — та же generic-по-ключу схема, что у скрытия
// (quickActionPrefs.test.ts): пустой порядок = порядок реестра, новый id
// реестра — в конец, stable.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseActionOrder,
  serializeActionOrder,
  getActionOrder,
  applyActionOrder,
  withDragRange,
  applyReorderToIndex,
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

describe('withDragRange', () => {
  it('одна группа — все элементы делят один диапазон [0, length-1]', () => {
    const flagged = withDragRange([[{ id: 'a' }, { id: 'b' }, { id: 'c' }]]);
    expect(flagged).toEqual([
      { id: 'a', rangeMin: 0, rangeMax: 2 },
      { id: 'b', rangeMin: 0, rangeMax: 2 },
      { id: 'c', rangeMin: 0, rangeMax: 2 },
    ]);
  });

  it('несколько групп — диапазон каждой это её сегмент в плоском списке', () => {
    const flagged = withDragRange([
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'c' }],
      [{ id: 'd' }, { id: 'e' }, { id: 'f' }],
    ]);
    expect(flagged).toEqual([
      { id: 'a', rangeMin: 0, rangeMax: 1 },
      { id: 'b', rangeMin: 0, rangeMax: 1 },
      { id: 'c', rangeMin: 2, rangeMax: 2 },
      { id: 'd', rangeMin: 3, rangeMax: 5 },
      { id: 'e', rangeMin: 3, rangeMax: 5 },
      { id: 'f', rangeMin: 3, rangeMax: 5 },
    ]);
  });

  it('пустая группа не сдвигает нумерацию следующих (offset не растёт)', () => {
    const flagged = withDragRange([[], [{ id: 'a' }]]);
    expect(flagged).toEqual([{ id: 'a', rangeMin: 0, rangeMax: 0 }]);
  });
});

describe('applyReorderToIndex', () => {
  it('перестановка с пустого порядка сохраняет полный список в новом месте', () => {
    const moved = applyReorderToIndex(
      PLUS_ACTIONS_ORDER_KEY,
      ['a', 'b', 'c'],
      'a',
      1,
    );
    expect(moved).toBe(true);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual(['b', 'a', 'c']);
  });

  it('перестановка через несколько позиций разом (не только на соседа)', () => {
    applyReorderToIndex(PLUS_ACTIONS_ORDER_KEY, ['a', 'b', 'c', 'd'], 'a', 3);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([
      'b',
      'c',
      'd',
      'a',
    ]);
  });

  it('toIndex === текущий индекс — false, localStorage не тронут', () => {
    const moved = applyReorderToIndex(
      PLUS_ACTIONS_ORDER_KEY,
      ['a', 'b', 'c'],
      'b',
      1,
    );
    expect(moved).toBe(false);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([]);
  });

  it('toIndex вне диапазона клэмпится к границе списка', () => {
    const moved = applyReorderToIndex(
      PLUS_ACTIONS_ORDER_KEY,
      ['a', 'b', 'c'],
      'a',
      999,
    );
    expect(moved).toBe(true);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual(['b', 'c', 'a']);
  });

  it('id не среди siblings — false, no-op', () => {
    expect(
      applyReorderToIndex(PLUS_ACTIONS_ORDER_KEY, ['a', 'b'], 'z', 1),
    ).toBe(false);
  });

  it('read-after-write: повторный вызов двигает дальше от уже сохранённого', () => {
    applyReorderToIndex(PLUS_ACTIONS_ORDER_KEY, ['a', 'b', 'c'], 'c', 0); // c a b
    applyReorderToIndex(PLUS_ACTIONS_ORDER_KEY, ['c', 'a', 'b'], 'b', 0); // b c a
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual(['b', 'c', 'a']);
  });

  it('переставленный блок встаёт на место первого вхождения siblings, остальные id не двигаются', () => {
    localStorage.setItem(
      PLUS_ACTIONS_ORDER_KEY,
      serializeActionOrder(['x', 'a', 'y', 'b', 'z']),
    );
    applyReorderToIndex(PLUS_ACTIONS_ORDER_KEY, ['a', 'b'], 'a', 1);
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
    const moved = applyReorderToIndex(
      PLUS_ACTIONS_ORDER_KEY,
      ['a', 'b'],
      'b',
      0,
    );
    expect(moved).toBe(true);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual([
      'x',
      'y',
      'b',
      'a',
    ]);
  });

  it('два ключа-поверхности не задевают друг друга', () => {
    applyReorderToIndex(PLUS_ACTIONS_ORDER_KEY, ['a', 'b'], 'b', 0);
    applyReorderToIndex(TOOLS_ACTIONS_ORDER_KEY, ['p', 'q'], 'q', 0);
    expect(getActionOrder(PLUS_ACTIONS_ORDER_KEY)).toEqual(['b', 'a']);
    expect(getActionOrder(TOOLS_ACTIONS_ORDER_KEY)).toEqual(['q', 'p']);
  });
});
