import { buildBpdGuide as buildBase } from './bpd';
import type { ConcernGuideBuilder } from './types';

/** Досбор по Янгу (гл. 1) к курсу при ПРЛ: порядок «привязанность, потом автономия». Вынесено, чтобы bpd.ts не рос. */
const ATTACHMENT_FIRST = [
  'Порядок при ПРЛ [Янг, гл. 1]. Такие клиенты похожи на маленьких детей, поэтому сначала у них формируется надёжная привязанность к терапевту и только потом идут сепарация и индивидуация.',
  'Работать только со взрослой частью личности, как у Райла, мало: обращаются прямо к детской части [Янг, гл. 1]. Поэтому автономию при ПРЛ в начале курса не торопят.',
];

export const buildBpdGuide: ConcernGuideBuilder = (tr) => {
  const guide = buildBase(tr);
  const course = guide.course ?? [];
  return {
    ...guide,
    course: [...course.slice(0, 4), ...ATTACHMENT_FIRST, ...course.slice(4)],
    sources: `${guide.sources}, [Янг, гл. 1]`,
  };
};
