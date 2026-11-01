import type { TherapyClientSummary } from '../../api';
import { calcTherapyDuration, isActiveToday, isVirtualClient } from './clientSheetHelpers';

/** Строка шапки клиента: «в боте · активность сегодня · в работе … · N дн. подряд»; части только из данных.
 *  «Сегодня» — по календарю клиента (isActiveToday, daysSinceActive от сервера), не по дню терапевта (№25). */
export function clientHeaderMeta(client: TherapyClientSummary): string {
  const duration = client.therapyStartDate ? calcTherapyDuration(client.therapyStartDate) : '';
  return [
    !isVirtualClient(client) && 'в боте',
    isActiveToday(client) && 'активность сегодня',
    duration && `в работе ${duration}`,
    client.streak > 0 && `${client.streak} дн. подряд`,
  ].filter(Boolean).join(' · ');
}
