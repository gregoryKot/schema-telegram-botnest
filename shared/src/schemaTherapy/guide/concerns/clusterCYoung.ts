import { buildClusterCGuide as buildBase } from './cluster_c';
import type { ConcernGuideBuilder } from './types';

/** Досбор по Янгу (гл. 1) к «Кластеру C»: рисунок отношений с терапевтом. Вынесено, чтобы cluster_c.ts не рос. */
const RELATIONSHIP_YOUNG = [
  'Отношения с терапевтом — окно оценки, а не помеха протоколу [Янг, гл. 1]: трудности в кабинете повторяют трудности с людьми вообще.',
  'При зависимом расстройстве клиент поглощён тем, чтобы терапевт закрыл его эмоциональные потребности, и почти не занимается жизнью вне терапии: он предпочитает получать утешение, а не учиться справляться сам [Янг, гл. 1].',
  'При обсессивно-компульсивном расстройстве клиент держится на дистанции или враждебен, и сотрудничество не складывается [Янг, гл. 1].',
];

export const buildClusterCGuide: ConcernGuideBuilder = (tr) => {
  const guide = buildBase(tr);
  return {
    ...guide,
    relationship: [...(guide.relationship ?? []), ...RELATIONSHIP_YOUNG],
    sources: `${guide.sources}, [Янг, гл. 1]`,
  };
};
