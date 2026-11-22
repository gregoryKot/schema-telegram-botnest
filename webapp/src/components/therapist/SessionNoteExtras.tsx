import type { TherapistNote } from '../../api';
import { planNamesOf } from './sessionPlanNames';
import { SessionWorkList } from './SessionWorkList';
import type { NamedMode } from './useCustomModeNames';

/** Под текстом записи: «Что делали» и «Из плана» (названия отмеченных пунктов; удалённые пропущены). */
export function SessionNoteExtras({ note, customModes, planTitles }: { note: TherapistNote; customModes?: NamedMode[]; planTitles?: ReadonlyMap<number, string> }) {
  const names = planTitles ? planNamesOf(note.planItemIds, planTitles) : [];
  return (
    <>
      <SessionWorkList work={note.work} customModes={customModes} />
      {names.length > 0 && <div className="tb-meta spb-note">Из плана: {names.join(', ')}</div>}
    </>
  );
}
