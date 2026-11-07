import { pressable } from '../../utils/a11y';
import { Strokes } from '../../components/art/PaperArt';
import { trackerDayLabel, type TrackerDay } from './trackerEntries';

// Строка трекера в ленте дня: тап открывает историю оценок (как строка трекера на главной).
export function TrackerEntry({ day, onOpen }: { day: TrackerDay; onOpen?: () => void }) {
  return (
    <div className="ds-card ds-card--row ds-card--nav ds-card--hover cd-entry cd-entry--tracker" {...(onOpen ? pressable(onOpen) : {})}>
      <span className="pp-row-art"><Strokes size="row" /></span>{trackerDayLabel(day)}{onOpen && <span className="ds-chev" aria-hidden="true" />}
    </div>
  );
}
