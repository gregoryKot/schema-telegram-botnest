import { buildOtherPersonalityDisordersGuide as buildBase } from './other_personality_disorders';
import type { ConcernGuideBuilder } from './types';

/** Досбор по Янгу (гл. 1): рисунок отношений с терапевтом при параноидном расстройстве. Вынесено, чтобы статья не росла. */
const RELATIONSHIP_YOUNG = [
  'Отношения с терапевтом — окно оценки, а не помеха протоколу [Янг, гл. 1]: трудности в кабинете повторяют трудности с людьми вообще.',
  'При параноидном расстройстве, как при нарциссическом, шизоидном и обсессивно-компульсивном, клиент держится на дистанции или враждебен, и сотрудничество не складывается [Янг, гл. 1].',
];

export const buildOtherPersonalityDisordersGuide: ConcernGuideBuilder = (
  tr,
) => {
  const guide = buildBase(tr);
  return {
    ...guide,
    relationship: [...(guide.relationship ?? []), ...RELATIONSHIP_YOUNG],
    sources: `${guide.sources}, [Янг, гл. 1]`,
  };
};
