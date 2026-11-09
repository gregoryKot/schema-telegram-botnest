// Полоски главной: оценка дня по потребностям в порядке NEED_ORDER, без оценки — null.
import { describe, it, expect } from 'vitest';
import { strokeValues } from './strokeValues';

describe('strokeValues', () => {
  it('пустой день — пять пустых мест, ничего выдуманного', () => {
    expect(strokeValues({})).toEqual([null, null, null, null, null]);
  });
  it('оценки встают на место своей потребности, порядок — NEED_ORDER', () => {
    expect(strokeValues({ limits: 3, attachment: 6, play: 10 })).toEqual([6, null, null, 10, 3]);
  });
  it('0 — «не оценено» (откат отклонённой оценки), как отсутствие ключа', () => {
    expect(strokeValues({ attachment: 0, autonomy: 4 })).toEqual([null, 4, null, null, null]);
  });
  it('чужой ключ не сдвигает полоски', () => {
    expect(strokeValues({ unknown: 7, expression: 5 })).toEqual([null, null, 5, null, null]);
  });
});
