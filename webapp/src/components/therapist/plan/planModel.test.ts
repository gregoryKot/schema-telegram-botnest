import { describe, it, expect } from 'vitest';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import { canAssign, cleanText, groupPlan, isEmptyPlan, nextStatus, planCounts, statusLabel } from './planModel';

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 1, clientId: '7', rubric: 'custom', text: 'пункт', status: 'planned', position: 0,
  source: null, taskId: null, createdAt: '2026-11-17T00:00:00.000Z', updatedAt: '2026-11-17T00:00:00.000Z', ...over,
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
    expect(groups.map((g) => g.label)).toEqual(['В отношениях', 'Между сессиями', 'Своё']);
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
