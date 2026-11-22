// Вкладка «Путь терапии»: обзор без номера, фазы — 1…N по порядку; лист фазы собирает переходы только на то,
// у чего в справочнике есть свой лист, и знает соседние листы пути.
import { describe, it, expect } from 'vitest';
import type { PhaseGuide } from '../../../../shared/src/schemaTherapy/guide';
import { FIXTURE_GUIDE, FIXTURE_PRACTICE_NOTE, FIXTURE_TECHNIQUES } from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';
import { phaseLabel, phaseSteps, phaseView } from './guideReferencePhases';

const tr = (ty: string) => ty;
const phase = (id: string, over: Partial<PhaseGuide> = {}): PhaseGuide => ({ id, name: id, goal: 'цель', essence: 'суть', sources: '', ...over });
const texts = {
  buildModeGuides: () => [FIXTURE_GUIDE],
  buildTechniqueGuides: () => FIXTURE_TECHNIQUES,
  practiceNotes: () => [FIXTURE_PRACTICE_NOTE],
};

describe('phaseSteps', () => {
  it('обзор номера не получает, фазы нумеруются по порядку с единицы', () => {
    expect([...phaseSteps(['overview', 'bonding', 'change'])]).toEqual([['bonding', 1], ['change', 2]]);
    expect(phaseSteps([]).size).toBe(0);
  });

  it('подпись листа: «Фаза N», у обзора — имя вкладки', () => {
    expect(phaseLabel(3)).toBe('Фаза 3');
    expect(phaseLabel(undefined)).toBe('Путь терапии');
  });
});

describe('phaseView', () => {
  const phases = [
    phase('overview'),
    phase('bonding', { modeIds: ['vulnerable_child', 'angry_child'], techniques: [FIXTURE_TECHNIQUES[1].id, FIXTURE_TECHNIQUES[0].id], noteIds: ['group_therapy', 'нет'] }),
    phase('change'),
  ];

  it('переходы — в порядке листа; режим и заметка без своего листа выпадают', () => {
    const view = phaseView(texts, tr, phases, 'bonding')!;
    expect(view.step).toBe(1);
    expect(view.modes).toEqual([{ id: 'vulnerable_child', name: 'Уязвимый Ребёнок', sub: FIXTURE_GUIDE.goal }]);
    expect(view.techniques).toEqual([FIXTURE_TECHNIQUES[1], FIXTURE_TECHNIQUES[0]]);
    expect(view.notes).toEqual([{ id: 'group_therapy', name: FIXTURE_PRACTICE_NOTE.title, sub: FIXTURE_PRACTICE_NOTE.summary }]);
  });

  it('соседи — предыдущий и следующий лист пути; у краёв соседа нет', () => {
    expect(phaseView(texts, tr, phases, 'bonding')).toMatchObject({ prev: { id: 'overview' }, next: { id: 'change' } });
    const first = phaseView(texts, tr, phases, 'overview')!;
    expect([first.step, first.prev, first.next?.id]).toEqual([undefined, undefined, 'bonding']);
    expect(phaseView(texts, tr, phases, 'change')?.next).toBeUndefined();
  });

  it('неизвестный лист — null', () => {
    expect(phaseView(texts, tr, phases, 'нет')).toBeNull();
  });
});
