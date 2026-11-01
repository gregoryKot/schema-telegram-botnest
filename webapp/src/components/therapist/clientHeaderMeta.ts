import type { TherapyClientSummary } from '../../api';
import { todayCalendarDate } from '../../../../shared/src/utils/calendarDate';
import { calcTherapyDuration, isVirtualClient } from './clientSheetHelpers';

/** Строка шапки клиента: «в боте · активность сегодня · в работе … · N дн. подряд»; части только из данных. */
export function clientHeaderMeta(client: TherapyClientSummary): string {
  const duration = client.therapyStartDate ? calcTherapyDuration(client.therapyStartDate) : '';
  return [
    !isVirtualClient(client) && 'в боте',
    client.lastActiveDate === todayCalendarDate() && 'активность сегодня',
    duration && `в работе ${duration}`,
    client.streak > 0 && `${client.streak} дн. подряд`,
  ].filter(Boolean).join(' · ');
}
