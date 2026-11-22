import { describe, it, expect } from 'vitest';
import { planNamesOf } from './sessionPlanNames';

const titles = new Map([[1, 'Работа со стулом'], [2, ' Дневник режимов ']]);

describe('planNamesOf', () => {
  it('id в названия, по порядку отметки', () => {
    expect(planNamesOf([2, 1], titles)).toEqual(['Дневник режимов', 'Работа со стулом']);
  });
  it('висячие id пропускаются', () => {
    expect(planNamesOf([1, 99], titles)).toEqual(['Работа со стулом']);
  });
  it('нет отметок — пусто', () => {
    expect(planNamesOf(undefined, titles)).toEqual([]);
    expect(planNamesOf([], titles)).toEqual([]);
  });
});
