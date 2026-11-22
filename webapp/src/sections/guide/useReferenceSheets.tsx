import { useState } from 'react';
import { api } from '../../api';
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { Tr } from '../../../../shared/src/needs/types';
import { useConceptGuide, type GuideOpenTrack } from '../../components/therapist/guide/useConceptGuide';
import { PracticeNoteSheet } from '../../components/therapist/guide/PracticeNoteSheet';
import type { ReferenceItem } from './guideReferenceModel';
import { useListSheets } from './useListSheets';

// Открытия листов из «Справочника» — свои события, не concept_guide_* схемы случая.
const REFERENCE_TRACK: GuideOpenTrack = {
  mode: () => api.trackEvent('cabinet_guide_mode_open'),
  schema: () => api.trackEvent('cabinet_guide_schema_open'),
  technique: () => api.trackEvent('cabinet_guide_technique_open'),
};

/**
 * Листы «Справочника»: `open` открывает лист строки списка, `sheets` — открытые листы. Режим, схема и техника —
 * те же листы, что в схеме случая (useConceptGuide), без клиента: без «Дать заданием», отметок и истории;
 * «В план» — с выбором клиентов. Потребность, запрос (useListSheets) и раздел «Для терапевта» — свои листы.
 */
export function useReferenceSheets(texts: Guide, tr: Tr) {
  const [noteId, setNoteId] = useState<string | null>(null);
  const note = noteId ? texts.practiceNotes(tr).find((n) => n.id === noteId) : undefined;
  const list = useListSheets(texts, tr);
  // plan и «Про клиента» без клиента: листы дают выбрать клиентов; листы «Для терапевта» и запроса — с тем же «Про клиента»
  const guide = useConceptGuide({
    track: REFERENCE_TRACK, plan: {}, pickClient: true,
    over: <>{note && <PracticeNoteSheet note={note} onClose={() => setNoteId(null)} />}{list.over}</>,
  });
  const open = (item: ReferenceItem) => {
    if (list.open(item)) return;
    if (item.kind === 'mode') guide.actions.onOpenMode(item.id);
    else if (item.kind === 'schema') guide.actions.onOpenSchema(item.id);
    else if (item.kind === 'technique') guide.actions.onOpenTechnique(item.id);
    else {
      api.trackEvent('cabinet_guide_note_open');
      setNoteId(item.id);
    }
  };
  const sheets = (
    <>
      {list.under(guide.actions.onOpenSchema)}
      {guide.sheets}
    </>
  );
  return { open, sheets, markCoping: guide.markCoping };
}
