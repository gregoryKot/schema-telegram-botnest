import { describe, it, expect } from 'vitest';
import { freshShelf, freshStartForced, groupOrder, isFreshProfile, SHELF_IDS, visibleInOrder } from './profileLayout';
import type { ScreenBlockId } from '../../../../shared/src/screens/screenBlocks';

const ZERO = { totalDays: 0, diaryCount: 0, ysqCount: 0, patterns: 0, warmWords: 0, earnedAchievements: 0 };
const order = (orderedIds: ScreenBlockId[], hidden: ScreenBlockId[] = []) => ({ orderedIds, isHidden: (id: ScreenBlockId) => hidden.includes(id) });

describe('isFreshProfile', () => {
  it('ни одной отметки — профиль пустой', () => {
    expect(isFreshProfile(ZERO)).toBe(true);
  });
  it.each(Object.keys(ZERO))('одно ненулевое «%s» — профиль уже не пустой', (key) => {
    expect(isFreshProfile({ ...ZERO, [key]: 1 })).toBe(false);
  });
});

describe('пустой профиль', () => {
  it('из витрины остаётся только «Мой путь»', () => {
    expect(SHELF_IDS.filter(freshShelf)).toEqual(['journey']);
  });
  it('герой начала встаёт без блока, только когда скрыты и портрет, и путь', () => {
    const hidden = (ids: ScreenBlockId[]) => ({ isHidden: (id: ScreenBlockId) => ids.includes(id) });
    expect(freshStartForced(hidden(['portrait', 'journey']))).toBe(true);
    expect(freshStartForced(hidden(['portrait']))).toBe(false);
    expect(freshStartForced(hidden([]))).toBe(false);
  });
});

describe('visibleInOrder', () => {
  it('порядок — из «Настроить экран», скрытые и пустые выпадают', () => {
    const o = order(['portrait', 'warm_words', 'journey', 'streak'], ['portrait']);
    expect(visibleInOrder(SHELF_IDS, o)).toEqual(['warm_words', 'journey']);
    expect(visibleInOrder(SHELF_IDS, o, (id) => id !== 'warm_words')).toEqual(['journey']);
  });
  it('переставленный блок меняет место плитки', () => {
    expect(visibleInOrder(SHELF_IDS, order(['journey', 'warm_words', 'portrait']))).toEqual(['journey', 'warm_words', 'portrait']);
  });
});

describe('groupOrder', () => {
  it('место группы — место её первого видимого блока, с 1', () => {
    const o = order(['portrait', 'warm_words', 'journey', 'streak', 'heatmap']);
    expect(groupOrder(['streak', 'heatmap'], o)).toBe(4);
    expect(groupOrder(['heatmap'], o)).toBe(5);
    expect(groupOrder(['journey', 'portrait'], o)).toBe(1);
  });
  it('пустая группа — 0', () => {
    expect(groupOrder([], order(['streak']))).toBe(0);
  });
});
