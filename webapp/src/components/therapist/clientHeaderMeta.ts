import type { TherapyClientSummary } from '../../api';
import { todayCalendarDate } from '../../../../shared/src/utils/calendarDate';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { calcTherapyDuration, isVirtualClient, nextSessionLabel } from './clientSheetHelpers';

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

/** Подпись ближайшей встречи для шапки: прошедшая дата переезжает на ближайший день встреч (как в карточке «Следующая сессия»); встречи нет — null. */
export function clientNextSession(client: TherapyClientSummary): string | null {
  const at = upcomingSession(client.nextSession, client.meetingDays);
  return at ? nextSessionLabel(at) || null : null;
}
