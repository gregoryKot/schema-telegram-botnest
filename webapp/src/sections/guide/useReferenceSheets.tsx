import { useMemo, useState } from 'react';
import { api } from '../../api';
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { NeedId, Tr } from '../../../../shared/src/needs/types';
import { useConceptGuide, type GuideOpenTrack } from '../../components/therapist/guide/useConceptGuide';
import { PracticeNoteSheet } from '../../components/therapist/guide/PracticeNoteSheet';
import { NeedGuideSheet } from '../../components/therapist/guide/NeedGuideSheet';
import type { ReferenceItem } from './guideReferenceModel';
import { buildNeedGuides } from './guideReferenceNeeds';

// Открытия листов из «Справочника» — свои события, не concept_guide_* схемы случая.
const REFERENCE_TRACK: GuideOpenTrack = {
  mode: () => api.trackEvent('cabinet_guide_mode_open'),
  schema: () => api.trackEvent('cabinet_guide_schema_open'),
  technique: () => api.trackEvent('cabinet_guide_technique_open'),
};

/**
 * Листы «Справочника»: `open` открывает лист строки списка, `sheets` — открытые листы. Режим, схема и техника —
 * те же листы, что в схеме случая (useConceptGuide), без клиента: без «Дать заданием», отметок и истории;
 * «В план» — с выбором клиентов. Потребность и раздел «Для терапевта» — свои листы.
 */
export function useReferenceSheets(texts: Guide, tr: Tr) {
  const [noteId, setNoteId] = useState<string | null>(null);
  const [needId, setNeedId] = useState<NeedId | null>(null);
  // plan и «Про клиента» без клиента: листы дают выбрать клиентов
  const guide = useConceptGuide({ track: REFERENCE_TRACK, plan: {}, pickClient: true });
  const need = useMemo(() => (needId ? buildNeedGuides(texts, tr).find((n) => n.id === needId) : undefined), [texts, tr, needId]);
  const note = noteId ? texts.practiceNotes(tr).find((n) => n.id === noteId) : undefined;
  const open = (item: ReferenceItem) => {
    if (item.kind === 'mode') guide.actions.onOpenMode(item.id);
    else if (item.kind === 'schema') guide.actions.onOpenSchema(item.id);
    else if (item.kind === 'technique') guide.actions.onOpenTechnique(item.id);
    else if (item.kind === 'need') {
      api.trackEvent('cabinet_guide_need_open');
      setNeedId(item.id);
    } else {
      api.trackEvent('cabinet_guide_note_open');
      setNoteId(item.id);
    }
  };
  const sheets = (
    <>
      {/* до листов схемы и техники: лист схемы, открытый из потребности, встаёт поверх порядком в DOM */}
      {need && <NeedGuideSheet need={need} onOpenSchema={guide.actions.onOpenSchema} onClose={() => setNeedId(null)} />}
      {guide.sheets}
      {note && <PracticeNoteSheet note={note} onClose={() => setNoteId(null)} />}
    </>
  );
  return { open, sheets, markCoping: guide.markCoping };
}
