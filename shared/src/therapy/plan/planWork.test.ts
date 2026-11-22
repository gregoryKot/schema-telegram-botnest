import { describe, expect, it } from 'vitest';
import type { PlanItem, PlanStatus } from './planItem';
import {
  planWorkCandidates,
  planWorkLine,
  summarizePlanWork,
} from './planWork';

const item = (
  id: number,
  status: PlanStatus,
  phaseId: number | null,
  position = id,
): PlanItem => ({
  id,
  clientId: '1',
  rubric: 'custom',
  text: `п${id}`,
  status,
  position,
  sourceAddress: null,
  source: null,
  taskId: null,
  phaseId,
  createdAt: '',
  updatedAt: '',
});

describe('summarizePlanWork', () => {
  it('последний — по максимальной дате, а не по порядку массива', () => {
    const m = summarizePlanWork([
      { noteId: 5, date: '2026-11-12', planItemIds: [1, 2] },
      { noteId: 9, date: '2026-10-01', planItemIds: [1] },
    ]);
    expect(m.get(1)).toEqual({
      count: 2,
      lastDate: '2026-11-12',
      lastNoteId: 5,
    });
    expect(m.get(2)?.count).toBe(1);
  });
  it('при равных датах побеждает больший noteId', () => {
    const m = summarizePlanWork([
      { noteId: 7, date: '2026-11-12', planItemIds: [1] },
      { noteId: 3, date: '2026-11-12', planItemIds: [1] },
    ]);
    expect(m.get(1)?.lastNoteId).toBe(7);
  });
  it('повтор id в одной записи считается один раз', () => {
    const m = summarizePlanWork([
      { noteId: 1, date: '2026-11-12', planItemIds: [4, 4] },
    ]);
    expect(m.get(4)?.count).toBe(1);
  });
});

describe('planWorkCandidates', () => {
  it('только planned и active; текущая фаза первой, затем по пути, без фазы последними', () => {
    const items = [
      item(1, 'planned', null),
      item(2, 'done', 10),
      item(3, 'active', 20),
      item(4, 'planned', 30),
      item(5, 'planned', 20, 0),
      item(6, 'dropped', 20),
      item(7, 'planned', 999),
    ];
    const ids = planWorkCandidates(items, 20, [10, 20, 30]).map((i) => i.id);
    expect(ids).toEqual([5, 3, 4, 1, 7]);
  });
  it('нет текущей фазы — порядок пути', () => {
    const items = [item(1, 'planned', 30), item(2, 'planned', 10)];
    expect(planWorkCandidates(items, null, [10, 30]).map((i) => i.id)).toEqual([
      2, 1,
    ]);
  });
});

describe('planWorkLine', () => {
  const d = '2026-11-12';
  it.each([
    [1, 'работали 1 раз — 12 ноября'],
    [2, 'работали 2 раза, последний — 12 ноября'],
    [3, 'работали 3 раза, последний — 12 ноября'],
    [5, 'работали 5 раз, последний — 12 ноября'],
    [11, 'работали 11 раз, последний — 12 ноября'],
    [21, 'работали 21 раз, последний — 12 ноября'],
    [22, 'работали 22 раза, последний — 12 ноября'],
  ])('count=%i', (count, text) => {
    expect(planWorkLine({ count, lastDate: d, lastNoteId: 1 })).toBe(text);
  });
});
