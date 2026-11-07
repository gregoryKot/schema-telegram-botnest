import { useState } from 'react';
import { api } from '../../../api';
import type { BetweenSessionsItem } from '../../../../../shared/src/schemaTherapy/guide';
import type { ConceptGuideActions } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import type { GuideTask } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import type { AssignPreset } from '../assignTemplates';
import { guideAssignPreset } from './guideAssign';
import { guideJournal, type GuideGraph } from './guideJournal';
import { ConceptGuideSheets, type GuideOpen } from './ConceptGuideSheets';

const CLOSED: GuideOpen = { sheet: null, technique: null };

/** Событие открытия листа режима, схемы и техники; имя — литералом (трипваер analytics-sync). */
export interface GuideOpenTrack { mode: () => void; schema: () => void; technique: () => void }
const CONCEPT_TRACK: GuideOpenTrack = {
  mode: () => api.trackEvent('concept_guide_mode_open'),
  schema: () => api.trackEvent('concept_guide_schema_open'),
  technique: () => api.trackEvent('concept_guide_technique_open'),
};

/**
 * Подсказки терапевту на сайте (#995): колбэки плашки «Обычно в методе»
 * (`actions` → ConceptGraph `guide`) и листы, которые они открывают (`sheets`
 * рисуются после схемы случая — и после её листа «На весь экран», на том же
 * слое). Лист техники из листа режима или схемы ложится поверх него,
 * «Закрыть» у техники возвращает к разделу. «Дать заданием» отдаёт пункт
 * наверх готовым шаблоном листа «Новое задание» (guideAssignPreset) — с
 * режима и со схемы одинаково: лист назначения режим или схему снаружи не
 * принимает; без onAssign кнопки нет. `tasks` — задания клиента для строк
 * «давали …»; `graph` — связи схемы случая и их правка: отметки «Делали
 * сегодня» (guideJournal), без него кнопки отметки нет. События —
 * concept_guide_* (src/analytics/concept-events.constants.ts), без меты;
 * «Справочник» передаёт свои (`track`), чтобы открытия не смешивались.
 */
export function useConceptGuide({ onAssign, tasks, graph, track = CONCEPT_TRACK }: {
  onAssign?: (preset: AssignPreset) => void;
  tasks?: readonly GuideTask[];
  graph?: GuideGraph;
  track?: GuideOpenTrack;
} = {}) {
  const [open, setOpen] = useState<GuideOpen>(CLOSED);
  const actions: ConceptGuideActions = {
    onOpenMode: (id) => {
      track.mode();
      setOpen({ sheet: { kind: 'mode', id }, technique: null });
    },
    onOpenSchema: (id) => {
      track.schema();
      setOpen({ sheet: { kind: 'schema', id }, technique: null });
    },
    onOpenTechnique: (id, from) => {
      track.technique();
      setOpen((o) => ({ ...o, technique: { id, from } }));
    },
    onAssign: onAssign && ((item: BetweenSessionsItem) => {
      api.trackEvent('concept_guide_assign');
      onAssign(guideAssignPreset(item));
    }),
    tasks,
  };
  const journal = graph && guideJournal(graph, () => api.trackEvent('concept_guide_mark_done'));
  const sheets = (
    <ConceptGuideSheets
      open={open} actions={actions} journal={journal}
      onCloseSheet={() => setOpen(CLOSED)}
      onCloseTechnique={() => setOpen((o) => ({ ...o, technique: null }))}
    />
  );
  return { actions, sheets };
}
