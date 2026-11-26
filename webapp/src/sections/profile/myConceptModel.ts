// Подписи листа «Схема случая» клиента (MyConceptSheet). Даты — моменты (ISO
// с зоной), показываются днём зоны читателя (shared momentDate, правило №25).
import { fmtDate } from '../../../../shared/src/utils/format';
import { momentDayKey } from '../../../../shared/src/utils/momentDate';

/** «Открыта с 6 ноя · обновлена 7 ноя»; тот же день — без «обновлена», нечитаемая дата — без неё. */
export function myConceptDates(sharedAt: string, updatedAt: string): string {
  const shared = momentDayKey(sharedAt);
  const updated = momentDayKey(updatedAt);
  return [
    shared && `Открыта с ${fmtDate(shared)}`,
    updated && updated !== shared && `обновлена ${fmtDate(updated)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
