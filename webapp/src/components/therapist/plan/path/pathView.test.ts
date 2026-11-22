import { describe, it, expect } from 'vitest';
import type { PathPhase, TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import { buildPathTemplates } from '../../../../../../shared/src/therapy/path/templates';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';
import { buildPathView, formatPhaseRange, toggleCriterion } from './pathView';

const templates = buildPathTemplates((ty) => ty);
const phase = (over: Partial<PathPhase>): PathPhase => ({
  id: 1, position: 0, name: 'Фаза', goal: null, weeks: 2, templatePhaseId: null,
  startedAt: null, endedAt: null, criteriaDone: [], note: null, ...over,
});
const path = (phases: PathPhase[], templateId: string | null = 'general'): TherapyPath => ({
  id: 1, clientId: '7', startDate: '2026-01-12', templateId, phases, createdAt: '', updatedAt: '',
});
const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 1, clientId: '7', rubric: 'custom', text: 'пункт', status: 'planned', position: 0,
  sourceAddress: null, source: null, taskId: null, phaseId: null, createdAt: '', updatedAt: '', ...over,
});

describe('buildPathView', () => {
  const phases = [
    phase({ id: 1, position: 0, weeks: 4, templatePhaseId: 'assessment', startedAt: '2026-01-12', endedAt: '2026-02-09', criteriaDone: [0, 1, 7] }),
    phase({ id: 2, position: 1, weeks: 3, startedAt: '2026-02-09' }),
    phase({ id: 3, position: 2, weeks: 2 }),
  ];

  it('даты идут подряд от старта; текущая — начатая и не законченная, у неё «Завершить и перейти»', () => {
    const v = buildPathView(path(phases), [], templates);
    expect(v.rows.map((r) => r.dates.start)).toEqual(['2026-01-12', '2026-02-09', '2026-03-02']);
    expect(v.rows.map((r) => [r.current, r.done, r.action])).toEqual([[false, true, null], [true, false, 'advance'], [false, false, null]]);
    expect(v.openIndex).toBe(1);
    // фаза шаблона: критерии за пределами списка не считаются
    expect(v.rows[0].tpl?.id).toBe('assessment');
    expect(v.rows[0].criteriaDone).toBe(2);
    expect(v.rows[1].tpl).toBeNull();
  });

  it('текущей нет — «Начать фазу» у следующей, раскрыта первая не законченная; у последней текущей — «Завершить фазу»', () => {
    const idle = buildPathView(path([phases[0], phase({ id: 2, position: 1 })]), [], templates);
    expect(idle.rows.map((r) => r.action)).toEqual([null, 'start']);
    expect(idle.openIndex).toBe(1);
    const last = buildPathView(path([phases[0], phase({ id: 2, position: 1, startedAt: '2026-02-09' })]), [], templates);
    expect(last.rows[1].action).toBe('finish');
  });

  it('пункты — по фазам и по position; без фазы и с чужой фазой — в «Без фазы»; прогресс — только у фазы с пунктами', () => {
    const items = [
      item({ id: 1, phaseId: 2, position: 3, status: 'done' }),
      item({ id: 2, phaseId: 2, position: 1 }),
      item({ id: 3, phaseId: null }),
      item({ id: 4, phaseId: 99 }),
    ];
    const v = buildPathView(path(phases), items, templates);
    expect(v.rows[1].items.map((i) => i.id)).toEqual([2, 1]);
    expect(v.rows[1].progress).toMatchObject({ done: 1, total: 2 });
    expect(v.rows[0].progress).toBeNull();
    expect(v.unphased.map((i) => i.id)).toEqual([3, 4]);
  });
});

describe('formatPhaseRange', () => {
  it('последний день — накануне следующей фазы; через год — год у конца', () => {
    expect(formatPhaseRange({ start: '2026-01-12', end: '2026-02-10' })).toBe('12 янв — 9 февр');
    expect(formatPhaseRange({ start: '2026-12-21', end: '2027-01-11' })).toBe('21 дек — 10 янв 2027');
  });
});

it('toggleCriterion: отметка добавляется по порядку и снимается', () => {
  expect(toggleCriterion([2], 0)).toEqual([0, 2]);
  expect(toggleCriterion([0, 2], 2)).toEqual([0]);
});
