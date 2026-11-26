import { describe, it, expect } from 'vitest';
import { practiceGroups, techniqueGroups } from './guideReferenceTechniques';
import { buildTechniqueGuides, practiceNotes } from '../../../../shared/src/schemaTherapy/guide';
import { FIXTURE_PRACTICE_NOTE, FIXTURE_TECHNIQUES } from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const tr = (ty: string) => ty;

describe('techniqueGroups', () => {
  it('раскладывает по полю group в порядке списка групп, внутри — порядок библиотеки; группа сворачиваемая', () => {
    const borrowed = { ...FIXTURE_TECHNIQUES[0], id: 'defusion' as const, group: 'borrowed' as const, name: 'Дефузия', approach: 'ACT' };
    const socratic = { ...FIXTURE_TECHNIQUES[0], id: 'socratic_dialogue' as const, group: 'cognitive' as const, name: 'Сократ' };
    const groups = techniqueGroups([borrowed, ...FIXTURE_TECHNIQUES, socratic]);
    expect(groups.map((g) => g.key)).toEqual(['relationship', 'cognitive', 'experiential', 'behavioral', 'formulation', 'borrowed']);
    const by = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(by.experiential.items.map((i) => i.id)).toEqual(['imagery_rescripting', 'chairwork']);
    expect(by.cognitive).toMatchObject({ title: 'Когнитивные', hint: 'через понимание', fold: true });
    expect(by.cognitive.items.map((i) => i.name)).toEqual(['Сократ']);
    expect(by.borrowed.items.map((i) => i.name)).toEqual(['Дефузия']);
    expect(by.relationship.items).toEqual([]);
  });

  it('библиотека: каждая техника ровно в одной группе, ни одна не пропала', () => {
    const guides = buildTechniqueGuides(tr);
    const ids = techniqueGroups(guides).flatMap((g) => g.items.map((i) => i.id));
    expect(ids.sort()).toEqual(guides.map((g) => g.id).sort());
  });

  it('у каждой техники из других подходов — с чем сочетается', () => {
    const guides = buildTechniqueGuides(tr);
    for (const t of guides.filter((g) => g.approach)) expect(t.pairsWith?.trim(), t.id).toBeTruthy();
    for (const t of guides.filter((g) => !g.approach)) expect(t.pairsWith, t.id).toBeUndefined();
  });
});

describe('practiceGroups', () => {
  it('заметка встаёт в свою группу, у групп «Для терапевта» нет подписи простыми словами', () => {
    const groups = practiceGroups([FIXTURE_PRACTICE_NOTE]);
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([['start', 0], ['stuck', 0], ['hard', 0], ['therapist', 1], ['method', 0]]);
    expect(groups[3]).toMatchObject({ title: 'Терапевт и формат', fold: true, hint: undefined });
    expect(groups[3].items[0]).toMatchObject({ kind: 'note', id: FIXTURE_PRACTICE_NOTE.id, name: FIXTURE_PRACTICE_NOTE.title });
  });

  it('все заметки справочника разложены, каждая один раз', () => {
    const notes = practiceNotes(tr);
    const ids = practiceGroups(notes).flatMap((g) => g.items.map((i) => i.id));
    expect(ids.sort()).toEqual(notes.map((n) => n.id).sort());
  });
});
