// Подписи тумблера «Показать клиенту» (вкладка «Концептуализация»): до
// включения — что увидит клиент, после — с какого дня видит. Состав один на
// обе подписи и совпадает с белым списком сервера (src/therapy/client-concept-view.ts).
import { fmtDate } from '../../../../../shared/src/utils/format';
import { momentDayKey } from '../../../../../shared/src/utils/momentDate';

export const CONCEPT_SHARE_TITLE = 'Показать клиенту';
const SCOPE = 'схемы, режимы, потребности. Истоки и задачи терапии клиент не увидит';

/** Подпись под тумблером; `sharedAt` — момент показа (ISO) или null. */
export function conceptShareHint(sharedAt: string | null): string {
  if (!sharedAt) return `Схема случая появится в «Мой терапевт» у клиента: ${SCOPE}.`;
  const day = momentDayKey(sharedAt);
  return `Клиент видит схему случая${day ? ` с ${fmtDate(day)}` : ''}: ${SCOPE}.`;
}

/** Отказ PATCH: положение тумблера прежнее. */
export function conceptShareError(tr: (ty: string, vy: string) => string): string {
  return tr('Не получилось переключить показ. Попробуй ещё раз.', 'Не получилось переключить показ. Попробуйте ещё раз.');
}
