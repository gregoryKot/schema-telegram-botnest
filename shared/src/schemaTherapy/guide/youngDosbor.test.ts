// «Сохранил → нашёл»: пункты досбора по Янгу (гл. 1–3) лежат в файлах *Young.ts
// и доходят до собранного справочника — до записей, которые читает терапевт.
import { describe, it, expect } from 'vitest';
import {
  buildConcernGuides,
  buildPhaseGuides,
  buildTechniqueGuides,
  modeGuide,
  practiceNotes,
  schemaGuide,
  techniqueGuide,
} from './index';
import type { Tr } from './types';

const tr: Tr = (t) => t;
const has = (list: string[] | undefined, part: string) =>
  (list ?? []).some((x) => x.includes(part));

describe('досбор по Янгу доходит до справочника', () => {
  it('режим, схема и техника получают пункты в «Подробнее»', () => {
    expect(
      has(modeGuide(tr, 'detached_protector')?.more, 'дневник на старте'),
    ).toBe(true);
    expect(
      has(schemaGuide(tr, 'mistrust')?.guide.more, 'конфиденциальность'),
    ).toBe(true);
    expect(has(techniqueGuide(tr, 'cognitive_work')?.more, 'идёт первой')).toBe(
      true,
    );
    expect(buildTechniqueGuides(tr).length).toBeGreaterThan(0);
  });

  it('заметки «Для терапевта» получают пункты', () => {
    const note = (id: string) => practiceNotes(tr).find((n) => n.id === id);
    expect(has(note('questionnaires')?.more, 'Порядок Янга для YSQ')).toBe(
      true,
    );
    expect(has(note('therapy_aims')?.more, 'Ассимиляция')).toBe(true);
  });

  it('запросы cluster_c и other_personality_disorders получают «relationship»', () => {
    const concern = (id: string) =>
      buildConcernGuides(tr).find((c) => c.id === id);
    expect(has(concern('cluster_c')?.relationship, 'окно оценки')).toBe(true);
    expect(
      has(concern('other_personality_disorders')?.relationship, 'параноидном'),
    ).toBe(true);
    expect(concern('other_personality_disorders')?.sources).toContain('[Янг');
  });

  it('фаза assessment получает «more» и сохраняет условия перехода', () => {
    const phase = buildPhaseGuides(tr).find((p) => p.id === 'assessment');
    expect(has(phase?.more, 'Сны')).toBe(true);
    expect(phase?.transition?.length).toBe(2);
  });
});
