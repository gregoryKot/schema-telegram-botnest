import type { TherapyClientSummary } from '../../api';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { calcTherapyDuration, isActiveToday, nextSessionLabel } from './clientSheetHelpers';
import { clientStatus } from './rosterOrder';

/** Строка шапки клиента: «в приложении · активность сегодня · в работе … · N дн. подряд»; части только из данных.
 *  «Сегодня» — по календарю клиента (isActiveToday, daysSinceActive от сервера), не по дню терапевта (№25). */
export function clientHeaderMeta(client: TherapyClientSummary): string {
  const duration = client.therapyStartDate ? calcTherapyDuration(client.therapyStartDate) : '';
  const status = clientStatus(client); // метка — та же, что в списке клиентов
  return [
    status.inBot && status.label,
    isActiveToday(client) && 'активность сегодня',
    duration && `в работе ${duration}`,
    client.streak > 0 && `${client.streak} дн. подряд`,
  ].filter(Boolean).join(' · ');
}

/** Подпись ближайшей встречи для шапки: прошедшая дата переезжает на ближайший день встреч (как в карточке «Следующая сессия»); встречи нет — null. */
export function clientNextSession(client: TherapyClientSummary): string | null {
  const at = upcomingSession(client.nextSession, client.meetingDays);
  return at ? nextSessionLabel(at) || null : null;
}
