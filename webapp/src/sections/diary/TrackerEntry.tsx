import { pressable } from '../../utils/a11y';
import { trackerDayLabel, type TrackerDay } from './trackerEntries';

// Строка трекера в ленте дня: тап открывает историю оценок (как строка трекера на главной).
export function TrackerEntry({ day, onOpen }: { day: TrackerDay; onOpen?: () => void }) {
  return (
    <div className="ds-card ds-card--row ds-card--hover cd-entry cd-entry--tracker" {...(onOpen ? pressable(onOpen) : {})}>
      {trackerDayLabel(day)}
      {onOpen && <span className="ds-link" aria-hidden="true">→</span>}
    </div>
  );
}
