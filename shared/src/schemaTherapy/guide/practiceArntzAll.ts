import type { PracticeNote, PracticeNotesBuilder } from './types';
import { buildPracticeNotes as buildBase } from './practice';
import { therapyAimsArntzIntro } from './practiceMoreArntzIntro';
import {
  complaintToModeArntzConcept,
  conceptMoreArntz,
  storySignalArntzConcept,
} from './practiceMoreArntzConcept';
import { sessionStructureArntz4 } from './techniques/arntzGeneralMore';

/** Дополнения Арнтц и Якоб к «Подробнее» заметок «Для терапевта» по id; перед последним пунктом
 *  (отсылка или итог) — те, что в `BEFORE_LAST`. */
const NOTE_MORE: Record<string, string[]> = {
  therapy_aims: therapyAimsArntzIntro,
  session_structure: sessionStructureArntz4,
  complaint_to_mode: complaintToModeArntzConcept,
  story_as_mode_signal: storySignalArntzConcept,
  mode_family_by_feeling: conceptMoreArntz,
};
const BEFORE_LAST = new Set(['session_structure', 'mode_family_by_feeling']);

const withArntz = (n: PracticeNote): PracticeNote => {
  const extra = NOTE_MORE[n.id];
  if (!extra) return n;
  const more = n.more ?? [];
  if (!BEFORE_LAST.has(n.id)) return { ...n, more: [...more, ...extra] };
  return { ...n, more: [...more.slice(0, -1), ...extra, ...more.slice(-1)] };
};

export const buildPracticeNotes: PracticeNotesBuilder = (tr) =>
  buildBase(tr).map(withArntz);
