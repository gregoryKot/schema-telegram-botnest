// Гейт правила масштабирования справочника (#1484, п.2): у каждой техники и заметки «Для терапевта» есть `group`
// из закрытого списка. Поле обязательно и в типе, тест ловит запись, собранную мимо типа (каст, JSON).
import { describe, it, expect } from 'vitest';
import {
  buildTechniqueGuides,
  practiceNotes,
  PRACTICE_GROUPS,
  TECHNIQUE_GROUPS,
} from './index';
import { GUIDE_CHANNELS } from '../../therapy/plan/planItem';
import type { Tr } from './types';

const tr: Tr = (t) => t;
const ids = (groups: readonly { id: string }[]) => groups.map((g) => g.id);
const ungrouped = (
  items: { id: string; group?: string }[],
  allowed: string[],
) =>
  items.filter((i) => !i.group || !allowed.includes(i.group)).map((i) => i.id);

describe('группы справочника', () => {
  it('у каждой техники — группа из закрытого списка', () => {
    expect(ungrouped(buildTechniqueGuides(tr), ids(TECHNIQUE_GROUPS))).toEqual(
      [],
    );
  });

  it('у каждой заметки «Для терапевта» — группа из закрытого списка', () => {
    expect(ungrouped(practiceNotes(tr), ids(PRACTICE_GROUPS))).toEqual([]);
  });

  it('проверка ловит запись без группы и с чужой группой', () => {
    expect(
      ungrouped(
        [
          { id: 'a' },
          { id: 'b', group: 'новая' },
          { id: 'c', group: 'cognitive' },
        ],
        ['cognitive'],
      ),
    ).toEqual(['a', 'b']);
  });

  it('ни одна группа не пуста, id групп не повторяются', () => {
    const techniques = buildTechniqueGuides(tr);
    const notes = practiceNotes(tr);
    for (const g of TECHNIQUE_GROUPS)
      expect(
        techniques.some((t) => t.group === g.id),
        g.id,
      ).toBe(true);
    for (const g of PRACTICE_GROUPS)
      expect(
        notes.some((n) => n.group === g.id),
        g.id,
      ).toBe(true);
    expect(new Set(ids(TECHNIQUE_GROUPS)).size).toBe(TECHNIQUE_GROUPS.length);
    expect(new Set(ids(PRACTICE_GROUPS)).size).toBe(PRACTICE_GROUPS.length);
  });

  it('первые четыре группы техник — каналы метода, с теми же заголовками и подписями', () => {
    expect(TECHNIQUE_GROUPS.slice(0, 4)).toEqual(GUIDE_CHANNELS);
  });
});
