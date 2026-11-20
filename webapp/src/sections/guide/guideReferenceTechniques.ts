// Вкладки «Техники» и «Для терапевта» «Справочника» (#1484): записи раскладываются по своему полю `group` в порядке
// закрытого списка групп (shared/src/schemaTherapy/guide/guideGroups.ts), внутри группы — порядок библиотеки.
// Списков id здесь нет: новая запись встаёт в свою группу сама. Группа сворачивается (`fold`).
import type { PracticeNote, TechniqueGuide } from '../../../../shared/src/schemaTherapy/guide';
import { PRACTICE_GROUPS, TECHNIQUE_GROUPS, type GuideGroup } from '../../../../shared/src/schemaTherapy/guide/guideGroups';
import { practiceNoteLook, PRACTICE_HUE, techniqueGuideLook, TECHNIQUES_HUE } from '../../components/therapist/guide/guideLook';
import type { PaperHue } from '../../../../shared/src/theme/entityLook';
import type { ReferenceGroup, ReferenceItem } from './guideReferenceModel';

/** Записи по группам: пустую группу отсеивает buildReference. */
export function byGroup<Id extends string, T extends { group: Id }>(
  groups: readonly GuideGroup<Id>[], records: T[], toItem: (r: T) => ReferenceItem, hue: PaperHue,
): ReferenceGroup[] {
  return groups.map((g) => ({
    key: g.id, title: g.title, hint: g.hint, fold: true, look: { hue },
    items: records.filter((r) => r.group === g.id).map(toItem),
  }));
}

const technique = (t: TechniqueGuide): ReferenceItem => ({
  kind: 'technique', id: t.id, name: t.name, sub: t.summary, sign: techniqueGuideLook(t.id).sign,
});
const note = (n: PracticeNote): ReferenceItem => ({
  kind: 'note', id: n.id, name: n.title, sub: n.summary, sign: practiceNoteLook(n.id).sign,
});

export const techniqueGroups = (guides: TechniqueGuide[]) => byGroup(TECHNIQUE_GROUPS, guides, technique, TECHNIQUES_HUE);
export const practiceGroups = (notes: PracticeNote[]) => byGroup(PRACTICE_GROUPS, notes, note, PRACTICE_HUE);
