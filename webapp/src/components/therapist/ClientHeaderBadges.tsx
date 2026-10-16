import type { TherapyClientSummary } from '../../api';
import { todayCalendarDate } from '../../../../shared/src/utils/calendarDate';
import { calcTherapyDuration, isVirtualClient, nextSessionLabel } from './clientSheetHelpers';

/** Бейджи шапки: статус, срок терапии (только из данных), ближайшая сессия. */
export function ClientHeaderBadges({ client }: { client: TherapyClientSummary }) {
  const duration = client.therapyStartDate ? calcTherapyDuration(client.therapyStartDate) : '';
  const since = [duration && `в работе ${duration}`, client.streak > 0 && `${client.streak} дн. подряд`].filter(Boolean).join(' · ');
  const next = client.nextSession ? nextSessionLabel(client.nextSession) : '';
  return (
    <div className="tk-badges">
      {isVirtualClient(client)
        ? <span className="ds-badge">оффлайн</span>
        : <span className="ds-badge ds-badge--ok">в боте</span>}
      {client.lastActiveDate === todayCalendarDate() && <span className="ds-badge">был сегодня</span>}
      {since && <span className="ds-badge ds-badge--line">{since}</span>}
      {next && <span className="ds-badge ds-badge--accent">Сессия · {next}</span>}
    </div>
  );
}
