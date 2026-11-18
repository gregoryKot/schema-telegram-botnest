// Раздел «Техники» «Справочника»: техники схема-терапии одним листом без подписи и вторая
// группа «Из других подходов» — записи с `approach` (shared/src/schemaTherapy/guide/types.ts).
import type { TechniqueGuide } from '../../../../shared/src/schemaTherapy/guide';
import { techniqueGuideLook, TECHNIQUES_HUE } from '../../components/therapist/guide/guideLook';
import type { ReferenceGroup, ReferenceItem } from './guideReferenceModel';

export const BORROWED_GROUP_TITLE = 'Из других подходов';

const item = (t: TechniqueGuide): ReferenceItem => ({
  kind: 'technique', id: t.id, name: t.name, sub: t.summary, sign: techniqueGuideLook(t.id).sign,
});

/** Две группы в порядке библиотеки; пустую отсеивает buildReference. */
export function techniqueGroups(guides: TechniqueGuide[]): ReferenceGroup[] {
  const look = { hue: TECHNIQUES_HUE };
  return [
    { key: 'techniques', look, items: guides.filter((t) => !t.approach).map(item) },
    { key: 'borrowed', title: BORROWED_GROUP_TITLE, look, items: guides.filter((t) => t.approach).map(item) },
  ];
}
