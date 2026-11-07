import type { ConceptModeLink, ConceptSchemaLink, ConceptTechniqueMark } from '../../../../../shared/src/apiTypes';
import type { GuideFrom } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { findModeLink } from '../../../../../shared/src/therapy/conceptGraph/modeLinks';
import { findSchemaLink } from '../../../../../shared/src/therapy/conceptGraph/schemaLinks';
import { isMarkedOn, toggleLinkMark } from '../../../../../shared/src/therapy/conceptGraph/techniqueMarks';
import { todayStr } from '../../../../../shared/src/utils/format';

/** Связи схемы случая и их правка — то же, что получает граф (useClientConceptGraph → graphProps). */
export interface GuideGraph {
  source: { modeLinks: ConceptModeLink[]; schemaLinks: ConceptSchemaLink[] };
  onChangeLink: (link: ConceptModeLink) => void;
  onChangeSchemaLink: (link: ConceptSchemaLink) => void;
}

/** Журнал «Делали сегодня» раздела режима или схемы. */
export interface GuideJournal {
  marksOf: (from: GuideFrom) => ConceptTechniqueMark[] | undefined;
  markedToday: (techniqueId: string, from: GuideFrom) => boolean;
  toggleToday: (techniqueId: string, from: GuideFrom) => void;
}

const write = <L,>(r: { link: L; added: boolean }, save: (link: L) => void) => {
  save(r.link);
  return r.added;
};

/**
 * «Делали сегодня» в листе техники (#995): отметка — поле `done` связи режима
 * или схемы, из которой открыт лист, и уходит тем же путём, что правка связи
 * на графе (onChangeLink / onChangeSchemaLink → patchConcept → автосохранение),
 * без своего эндпоинта. Связи ещё нет — берётся пустая (findModeLink /
 * findSchemaLink), upsert её добавит. Повторный тап в тот же день снимает
 * сегодняшнюю отметку; `onMarked` (событие concept_guide_mark_done) — только
 * когда отметка поставлена. «Сегодня» — местный день терапевта (`todayStr()`).
 */
export function guideJournal(graph: GuideGraph, onMarked: () => void, today: () => string = todayStr): GuideJournal {
  const { source } = graph;
  const marksOf = (from: GuideFrom) =>
    from.kind === 'mode' ? findModeLink(source.modeLinks, from.id).done : findSchemaLink(source.schemaLinks, from.id).done;
  return {
    marksOf,
    markedToday: (techniqueId, from) => isMarkedOn(marksOf(from), techniqueId, today()),
    toggleToday: (techniqueId, from) => {
      const day = today();
      const added = from.kind === 'mode'
        ? write(toggleLinkMark(findModeLink(source.modeLinks, from.id), techniqueId, day), graph.onChangeLink)
        : write(toggleLinkMark(findSchemaLink(source.schemaLinks, from.id), techniqueId, day), graph.onChangeSchemaLink);
      if (added) onMarked();
    },
  };
}
