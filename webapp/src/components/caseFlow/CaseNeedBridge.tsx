import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { NEED_NAMES } from '../../../../shared/src/needs/needNames';
import { CASE_NEED_TRACKER_EVENT } from '../../../../shared/src/share/analytics';
import { TertiaryLink } from './caseLinks';

/** Мост «Записано» → трекер на потребности, выбранной в разборе. Нет потребности или входа в трекер — нет моста. */
export function CaseNeedBridge({ needId, onOpenTracker }: { needId: string; onOpenTracker?: (needId: string) => void }) {
  const tr = useTr();
  const name = NEED_NAMES[needId];
  if (!name || !onOpenTracker) return null;
  const open = () => {
    api.trackEvent(CASE_NEED_TRACKER_EVENT, { needId });
    onOpenTracker(needId);
  };
  return (
    <TertiaryLink
      label={`${tr('Отметь', 'Отметьте')} в трекере: ${name}`}
      onClick={open}
    />
  );
}
