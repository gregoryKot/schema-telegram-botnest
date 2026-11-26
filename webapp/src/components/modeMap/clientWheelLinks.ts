import { normalizeNeedLinks, type ConceptNeedLink } from '../../../../shared/src/therapy/conceptGraph/needLinks';

/** Оценки колеса из ответа сервера: заметки листа до узла не доходят, даже если пришли. */
export const clientWheelLinks = (raw: unknown): ConceptNeedLink[] =>
  normalizeNeedLinks(raw)
    .filter((link) => Object.keys(link.ratings).length > 0)
    .map((link) => ({ needId: link.needId, ratings: link.ratings, notes: {} }));
