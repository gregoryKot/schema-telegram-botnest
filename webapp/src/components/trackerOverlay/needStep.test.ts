import { describe, it, expect } from 'vitest';
import { stepNeedValue } from './needStep';

describe('stepNeedValue', () => {
  it('«+» добавляет единицу, «−» убирает', () => {
    expect(stepNeedValue(5, 1)).toBe(6);
    expect(stepNeedValue(5, -1)).toBe(4);
  });
  it('с нуля («нет оценки») «+» даёт 1, «−» остаётся нулём', () => {
    expect(stepNeedValue(0, 1)).toBe(1);
    expect(stepNeedValue(0, -1)).toBe(0);
  });
  it('границы шкалы: выше 10 и ниже 1 (при уже выставленной оценке) не уходит', () => {
    expect(stepNeedValue(10, 1)).toBe(10);
    expect(stepNeedValue(1, -1)).toBe(1);
  });
});
