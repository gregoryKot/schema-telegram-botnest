import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { api, type UserId } from '../../../api';
import type { BetweenSessionsItem, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import type { ConceptGuideActions } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import type { GuideTask } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import type { TechniqueJournalEntry } from '../../../../../shared/src/therapy/conceptGraph/techniqueJournal';
import type { SheetBack } from '../ConceptFullscreenSheet';
import type { AssignPreset } from '../assignTemplates';
import { PlanAddSheet } from '../plan/PlanAddSheet';
import { guideAssignPreset } from './guideAssign';
import { betweenRubricSeed, planDraft, sessionSeed, type PlanDraft } from './guidePlan';
import { guideJournal, type GuideGraph } from './guideJournal';
import { ConceptGuideSheets, type GuideOpen } from './ConceptGuideSheets';
import { CopingMarkSheet } from './CopingMarkSheet';
import { copingState, graphCopingTarget, type CopingCell } from './copingMark';
import type { SchemaCopingMarks } from './SchemaGuideSheet';
import { GuideMarkContext } from './marks/GuideSectionMark';
import { useClientGuideMarks, type GuideMarkClient } from './marks/useClientGuideMarks';
import { useGuideMarking } from './marks/useGuideMarking';

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
 * сегодня» (guideJournal), без него кнопки отметки нет. `onOpenJournal` —
 * «журнал →» за «делали …» (вкладка «Задания», блок «На сессиях»): сначала
 * закрываются листы — goBack нижнего открытого снимает и всё, что над ним
 * (`under` — схема «На весь экран» под листами подсказок), — затем переход;
 * без него ссылки нет. `openMark` — строка журнала техник: лист техники с
 * разделом и днём отметки; `anyOpen` — открыт ли какой-то лист. События — concept_guide_*
 * (src/analytics/concept-events.constants.ts), без меты; «Справочник»
 * передаёт свои (`track`), чтобы открытия не смешивались. `plan` — кнопки «В план» у рубрик листа и плашки, лист
 * выбора частей поверх: с `clientId` — в план этого клиента, без — терапевт выбирает клиентов.
 */
export function useConceptGuide({ onAssign, tasks, graph, track = CONCEPT_TRACK, onOpenJournal, under, plan, pickClient, client, over }: {
  onAssign?: (preset: AssignPreset) => void;
  tasks?: readonly GuideTask[];
  graph?: GuideGraph;
  track?: GuideOpenTrack;
  onOpenJournal?: () => void;
  under?: RefObject<SheetBack | null>;
  plan?: { clientId?: UserId; onAdded?: () => void };
  /** «Про клиента» на копингах без карточки («Справочник»): лист выбора клиента. */
  pickClient?: boolean;
  /** «Про клиента» (#1484): справочник из карточки — отметки этого клиента; без него — выбор клиента. */
  client?: GuideMarkClient;
  /** Свои листы вызывающего (лист «Для терапевта»): поверх листов раздела, под листом отметки. */
  over?: ReactNode;
} = {}) {
  const [open, setOpen] = useState<GuideOpen>(CLOSED);
  const [cell, setCell] = useState<CopingCell | null>(null);
  const clientName = graph?.clientName;
  // «Про клиента» на стиле копинга (#1484): из карточки — сразу её клиент, из «Справочника» — выбор.
  const copingFor = clientName || pickClient ? (schemaId: string): SchemaCopingMarks => ({
    onMark: (style) => setCell({ schemaId, style }),
    clientName,
    marked: graph && ((style) => copingState(graph.source.schemaLinks, { schemaId, style }).marked),
  }) : undefined;
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const marks = useClientGuideMarks(client);
  const marking = useGuideMarking(marks);
  const backRefs = { section: useRef<SheetBack | null>(null), technique: useRef<SheetBack | null>(null) };
  const leaveThen = (then: () => void) => {
    const back = under?.current ?? backRefs.section.current ?? backRefs.technique.current;
    if (back) back(then);
    else then();
  };
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
    onPlanSession: plan && ((t, from) => setDraft(planDraft(sessionSeed(t), from))),
    onPlanBetween: plan && ((b, from) => setDraft(planDraft(betweenRubricSeed(b), from))),
    tasks,
    onOpenJournal: onOpenJournal && (() => {
      api.trackEvent('concept_guide_journal_open');
      leaveThen(onOpenJournal);
    }),
  };
  const journal = graph && guideJournal(graph, () => api.trackEvent('concept_guide_mark_done'));
  const sheets = (
    <>
      <GuideMarkContext.Provider value={marking.ctx}>
        <ConceptGuideSheets
          open={open} actions={actions} journal={journal} backRefs={backRefs}
          onPlan={plan && ((seed, from) => setDraft(planDraft(seed, from)))} copingFor={copingFor}
          onCloseSheet={() => setOpen(CLOSED)} onCloseTechnique={() => setOpen((o) => ({ ...o, technique: null }))}
        />
        {over}
      </GuideMarkContext.Provider>
      {plan && draft && <PlanAddSheet draft={draft} clientId={plan.clientId} onAdded={plan.onAdded} onClose={() => setDraft(null)} />}
      {marking.node}
      {cell && copingFor && (
        <CopingMarkSheet cell={cell} fixed={graph && clientName ? graphCopingTarget(graph, clientName, cell) : undefined} onClose={() => setCell(null)} />
      )}
    </>
  );
  // id отметки — строка из данных; техники нет в библиотеке — лист не откроется (techniqueGuide → null).
  const openMark = ({ techniqueId, from, day }: TechniqueJournalEntry) => {
    api.trackEvent('concept_guide_journal_entry');
    setOpen({ sheet: null, technique: { id: techniqueId as TechniqueId, from, day } });
  };
  const anyOpen = open.sheet !== null || open.technique !== null; // журнал держит листы, пока открыт лист снятой отметки
  return { actions, sheets, openMark, anyOpen, marks, marking, markCoping: copingFor && ((c: CopingCell) => setCell(c)) };
}
