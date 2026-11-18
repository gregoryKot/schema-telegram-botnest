import { describe, it, expect } from 'vitest';
import { techniqueGroups, BORROWED_GROUP_TITLE } from './guideReferenceTechniques';
import { buildTechniqueGuides } from '../../../../shared/src/schemaTherapy/guide';
import { FIXTURE_TECHNIQUES } from '../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const tr = (ty: string) => ty;

describe('techniqueGroups', () => {
  it('техника с подходом уходит во вторую группу с подписью, остальные — в первую без подписи', () => {
    const borrowed = { ...FIXTURE_TECHNIQUES[0], id: 'defusion' as const, name: 'Дефузия', approach: 'ACT' };
    const [own, other] = techniqueGroups([borrowed, ...FIXTURE_TECHNIQUES]);
    expect(own.title).toBeUndefined();
    expect(own.items.map((i) => i.id)).toEqual(FIXTURE_TECHNIQUES.map((t) => t.id));
    expect(other.title).toBe(BORROWED_GROUP_TITLE);
    expect(other.items.map((i) => i.name)).toEqual(['Дефузия']);
  });

  it('библиотека: 29 техник схема-терапии и 12 из других подходов; у каждой из двенадцати — подход и с чем сочетается', () => {
    const guides = buildTechniqueGuides(tr);
    const [own, other] = techniqueGroups(guides);
    expect([own.items.length, other.items.length]).toEqual([29, 12]);
    for (const t of guides.filter((g) => g.approach)) expect(t.pairsWith?.trim(), t.id).toBeTruthy();
    for (const t of guides.filter((g) => !g.approach)) expect(t.pairsWith, t.id).toBeUndefined();
  });
});
