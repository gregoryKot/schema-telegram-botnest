import { describe, it, expect } from 'vitest';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import { canAssign, cleanText, groupPlan, isEmptyPlan, movePlanItem, nextStatus, planCounts, statusLabel } from './planModel';

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 1, clientId: '7', rubric: 'custom', text: 'пункт', status: 'planned', position: 0,
  sourceAddress: null, source: null, taskId: null, createdAt: '2026-11-17T00:00:00.000Z', updatedAt: '2026-11-17T00:00:00.000Z', ...over,
});

describe('groupPlan', () => {
  it('рубрики идут в порядке справочника, пустые не показываются, внутри — по position', () => {
    const groups = groupPlan([
      item({ id: 1, rubric: 'custom', position: 0 }),
      item({ id: 2, rubric: 'between', position: 3 }),
      item({ id: 3, rubric: 'relationship', position: 2 }),
      item({ id: 4, rubric: 'between', position: 1 }),
    ]);
    expect(groups.map((g) => g.rubric)).toEqual(['relationship', 'between', 'custom']);
    expect(groups.map((g) => g.label)).toEqual(['Терапевтические отношения (в отношениях)', 'Между сессиями', 'Своё']);
    expect(groups[1].items.map((i) => i.id)).toEqual([4, 2]);
  });

  it('незнакомая рубрика не теряется — уходит в «Своё»', () => {
    const groups = groupPlan([item({ id: 9, rubric: 'future' as PlanItem['rubric'] })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rubric).toBe('custom');
    expect(groups[0].items[0].id).toBe(9);
  });

  it('пустой план — ни одной группы', () => {
    expect(groupPlan([])).toEqual([]);
    expect(isEmptyPlan([])).toBe(true);
    expect(isEmptyPlan([item({})])).toBe(false);
  });
});

describe('статус', () => {
  it('цикл: намечено → в работе → сделано → намечено', () => {
    expect(nextStatus('planned')).toBe('active');
    expect(nextStatus('active')).toBe('done');
    expect(nextStatus('done')).toBe('planned');
    expect(nextStatus('чужой')).toBe('planned');
  });

  it('подписи; неизвестный статус читается как «намечено»', () => {
    expect([statusLabel('planned'), statusLabel('active'), statusLabel('done')]).toEqual(['намечено', 'в работе', 'сделано']);
    expect(statusLabel('чужой')).toBe('намечено');
  });

  it('счёт по статусам', () => {
    expect(planCounts([item({ status: 'done' }), item({ status: 'active' }), item({ status: 'done' })])).toEqual({ planned: 0, active: 1, done: 2 });
  });
});

describe('действия пункта', () => {
  it('«Дать заданием» — только «Между сессиями» без задания', () => {
    expect(canAssign({ rubric: 'between', taskId: null })).toBe(true);
    expect(canAssign({ rubric: 'between', taskId: 5 })).toBe(false);
    expect(canAssign({ rubric: 'session', taskId: null })).toBe(false);
    expect(canAssign({ rubric: 'custom', taskId: null })).toBe(false);
  });

  it('пустой текст не сохраняется, края обрезаются', () => {
    expect(cleanText('  \n ')).toBeNull();
    expect(cleanText('  стул  ')).toBe('стул');
  });
});

describe('movePlanItem', () => {
  // Порядок показа: between [4, 2], custom [1, 9 (незнакомая рубрика), 5].
  const plan = [
    item({ id: 1, rubric: 'custom', position: 0 }),
    item({ id: 2, rubric: 'between', position: 3 }),
    item({ id: 4, rubric: 'between', position: 1 }),
    item({ id: 9, rubric: 'future' as PlanItem['rubric'], position: 4 }),
    item({ id: 5, rubric: 'custom', position: 5 }),
  ];
  const ids = (list: PlanItem[] | null) => list?.map((i) => i.id);

  it('меняет пункт с соседом своей рубрики; список полный, position — 0..n-1 по порядку показа', () => {
    const next = movePlanItem(plan, 1, 1);
    expect(ids(next)).toEqual([4, 2, 9, 1, 5]);
    expect(next?.map((i) => i.position)).toEqual([0, 1, 2, 3, 4]);
    expect(ids(movePlanItem(plan, 2, -1))).toEqual([2, 4, 1, 9, 5]);
  });

  it('пункты других рубрик сохраняют взаимный порядок', () => {
    const next = movePlanItem(plan, 5, -1) ?? [];
    expect(groupPlan(next).map((g) => g.items.map((i) => i.id))).toEqual([[4, 2], [1, 5, 9]]);
  });

  it('край рубрики и незнакомый id — null', () => {
    expect(movePlanItem(plan, 4, -1)).toBeNull();
    expect(movePlanItem(plan, 2, 1)).toBeNull(); // ниже — уже другая рубрика
    expect(movePlanItem(plan, 5, 1)).toBeNull();
    expect(movePlanItem(plan, 77, 1)).toBeNull();
  });
});
