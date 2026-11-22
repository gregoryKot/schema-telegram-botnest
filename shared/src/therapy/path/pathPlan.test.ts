import { describe, expect, it } from 'vitest';
import {
  currentPhaseIndex,
  currentPhaseOverdue,
  nextPhaseIndex,
  overdueWeeks,
  pathEndDate,
  phaseDates,
  phaseDraftsFromTemplate,
  phaseProgress,
  progressByPhase,
} from './pathPlan';
import { buildPathTemplates, pathTemplateWeeks } from './templates';

const tr = (ty: string) => ty;
const mark = (startedAt: string | null, endedAt: string | null = null) => ({
  startedAt,
  endedAt,
});

describe('phaseDraftsFromTemplate', () => {
  it.each(buildPathTemplates(tr))(
    '$id: фазы в порядке шаблона, со сроком и ключом фазы',
    (template) => {
      const drafts = phaseDraftsFromTemplate(template);
      expect(drafts.map((d) => d.templatePhaseId)).toEqual(
        template.phases.map((p) => p.id),
      );
      expect(drafts.reduce((sum, d) => sum + d.weeks, 0)).toBe(
        pathTemplateWeeks(template),
      );
      expect(drafts.every((d) => d.name && d.goal)).toBe(true);
    },
  );
});

describe('phaseDates', () => {
  const phases = [{ weeks: 4 }, { weeks: 12 }, { weeks: 2 }];

  it('сроки идут подряд от старта, конец фазы — начало следующей', () => {
    expect(phaseDates('2026-01-05', phases)).toEqual([
      { start: '2026-01-05', end: '2026-02-02' },
      { start: '2026-02-02', end: '2026-04-27' },
      { start: '2026-04-27', end: '2026-05-11' },
    ]);
    expect(pathEndDate('2026-01-05', phases)).toBe('2026-05-11');
  });

  it('сдвиг срока одной фазы двигает следующие, предыдущие стоят', () => {
    const moved = phaseDates('2026-01-05', [
      { weeks: 4 },
      { weeks: 14 },
      { weeks: 2 },
    ]);
    expect(moved[0]).toEqual({ start: '2026-01-05', end: '2026-02-02' });
    expect(moved[2]).toEqual({ start: '2026-05-11', end: '2026-05-25' });
  });

  it('переход на летнее время и граница года дату не сбивают', () => {
    expect(phaseDates('2026-12-28', [{ weeks: 1 }, { weeks: 13 }])).toEqual([
      { start: '2026-12-28', end: '2027-01-04' },
      { start: '2027-01-04', end: '2027-04-05' },
    ]);
  });

  it('путь без фаз кончается в день старта', () => {
    expect(phaseDates('2026-01-05', [])).toEqual([]);
    expect(pathEndDate('2026-01-05', [])).toBe('2026-01-05');
  });
});

describe('текущая и следующая фаза', () => {
  it('ничего не начато: текущей нет, следующая — первая', () => {
    const phases = [mark(null), mark(null)];
    expect(currentPhaseIndex(phases)).toBe(-1);
    expect(nextPhaseIndex(phases)).toBe(0);
  });

  it('текущая — начатая и не законченная, следующая — за ней', () => {
    const phases = [
      mark('2026-01-05', '2026-02-01'),
      mark('2026-02-01'),
      mark(null),
    ];
    expect(currentPhaseIndex(phases)).toBe(1);
    expect(nextPhaseIndex(phases)).toBe(2);
  });

  it('между фазами текущей нет, следующая — первая не начатая', () => {
    const phases = [mark('2026-01-05', '2026-02-01'), mark(null)];
    expect(currentPhaseIndex(phases)).toBe(-1);
    expect(nextPhaseIndex(phases)).toBe(1);
  });

  it('последняя фаза идёт или путь пройден — следующей нет', () => {
    expect(nextPhaseIndex([mark('2026-01-05')])).toBe(-1);
    expect(nextPhaseIndex([mark('2026-01-05', '2026-02-01')])).toBe(-1);
  });
});

describe('расхождение с планом', () => {
  it('считает полные недели после планового конца', () => {
    expect(overdueWeeks('2026-02-02', '2026-02-01')).toBe(0);
    expect(overdueWeeks('2026-02-02', '2026-02-08')).toBe(0);
    expect(overdueWeeks('2026-02-02', '2026-02-09')).toBe(1);
    expect(overdueWeeks('2026-02-02', '2026-02-24')).toBe(3);
  });

  const phases = [
    { weeks: 4, ...mark('2026-01-05', '2026-02-02') },
    { weeks: 4, ...mark('2026-02-02') },
    { weeks: 4, ...mark(null) },
  ];

  it('текущая фаза в сроке — расхождения нет', () => {
    expect(currentPhaseOverdue('2026-01-05', phases, '2026-02-20')).toBeNull();
    expect(currentPhaseOverdue('2026-01-05', phases, '2026-03-05')).toBeNull();
  });

  it('текущая фаза по плану закончилась: недели и срок, который догоняет сегодня', () => {
    const overdue = currentPhaseOverdue('2026-01-05', phases, '2026-03-20');
    expect(overdue).toEqual({ index: 1, weeks: 2, catchUpWeeks: 7 });
    const caughtUp = phases.map((p, i) =>
      i === 1 ? { ...p, weeks: overdue!.catchUpWeeks } : p,
    );
    expect(
      currentPhaseOverdue('2026-01-05', caughtUp, '2026-03-20'),
    ).toBeNull();
    expect(phaseDates('2026-01-05', caughtUp)[2].start).toBe('2026-03-23');
  });

  it('текущей фазы нет — расхождения нет', () => {
    expect(
      currentPhaseOverdue('2026-01-05', [{ weeks: 1, ...mark(null) }], '2027-01-01'),
    ).toBeNull();
  });
});

describe('прогресс фазы', () => {
  it('«не нужно» из счёта выпадает, доля — сделанное от остального', () => {
    const progress = phaseProgress([
      { status: 'done' },
      { status: 'done' },
      { status: 'active' },
      { status: 'postponed' },
      { status: 'dropped' },
      { status: 'чужой' },
    ]);
    expect(progress).toEqual({
      planned: 1,
      active: 1,
      done: 2,
      postponed: 1,
      dropped: 1,
      total: 5,
      share: 0.4,
    });
  });

  it('считать не из чего — доли нет', () => {
    expect(phaseProgress([]).share).toBeNull();
    expect(phaseProgress([{ status: 'dropped' }]).share).toBeNull();
  });

  it('по фазам: пункты без фазы — под ключом null', () => {
    const byPhase = progressByPhase([
      { phaseId: 1, status: 'done' },
      { phaseId: 1, status: 'planned' },
      { phaseId: null, status: 'active' },
    ]);
    expect(byPhase.get(1)?.share).toBe(0.5);
    expect(byPhase.get(null)?.active).toBe(1);
    expect(byPhase.has(2)).toBe(false);
  });
});
