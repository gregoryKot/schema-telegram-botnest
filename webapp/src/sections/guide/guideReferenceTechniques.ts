// Вкладки «Техники» и «Для терапевта» «Справочника» (#1484): записи раскладываются по своему полю `group` в порядке
// закрытого списка групп (shared/…/guide/guideGroups.ts), внутри — порядок библиотеки; списков id здесь нет.
// Карточка несёт оттенок своей группы (guideLook.ts): на вкладке группы различимы цветом.
import type { PracticeNote, TechniqueGuide } from '../../../../shared/src/schemaTherapy/guide';
import { PRACTICE_GROUPS, TECHNIQUE_GROUPS, type GuideGroup } from '../../../../shared/src/schemaTherapy/guide/guideGroups';
import {
  practiceNoteLook, PRACTICE_GROUP_HUE, techniqueGuideLook, TECHNIQUE_GROUP_HUE,
} from '../../components/therapist/guide/guideLook';
import type { PaperHue } from '../../../../shared/src/theme/entityLook';
import type { ReferenceGroup, ReferenceItem } from './guideReferenceModel';

/** Записи по группам: пустую группу отсеивает buildReference. */
export function byGroup<Id extends string, T extends { group: Id }>(
  groups: readonly GuideGroup<Id>[], records: T[], toItem: (r: T) => ReferenceItem, hues: Record<Id, PaperHue>,
): ReferenceGroup[] {
  return groups.map((g) => ({
    key: g.id, title: g.title, hint: g.hint, fold: true, look: { hue: hues[g.id] },
    items: records.filter((r) => r.group === g.id).map(toItem),
  }));
}

const technique = (t: TechniqueGuide): ReferenceItem => {
  const look = techniqueGuideLook(t);
  return { kind: 'technique', id: t.id, name: t.name, sub: t.summary, ...look };
};
const note = (n: PracticeNote): ReferenceItem => {
  const look = practiceNoteLook(n);
  return { kind: 'note', id: n.id, name: n.title, sub: n.summary, ...look };
};

export const techniqueGroups = (guides: TechniqueGuide[]) => byGroup(TECHNIQUE_GROUPS, guides, technique, TECHNIQUE_GROUP_HUE);
export const practiceGroups = (notes: PracticeNote[]) => byGroup(PRACTICE_GROUPS, notes, note, PRACTICE_GROUP_HUE);
