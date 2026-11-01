import type { TherapyClientSummary } from '../../api';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { clientHeaderMeta } from './clientHeaderMeta';
import { isVirtualClient, nextSessionLabel } from './clientSheetHelpers';

/** Шапка клиента: «оффлайн» и ближайшая сессия — плашки, остальное — одна строка текста. */
export function ClientHeaderBadges({ client }: { client: TherapyClientSummary }) {
  const meta = clientHeaderMeta(client);
  const next = nextSessionLabel(upcomingSession(client.nextSession, client.meetingDays) ?? '');
  return (
    <div className="tk-badges">
      {isVirtualClient(client) && <span className="ds-badge">оффлайн</span>}
      {meta && <span className="tk-meta">{meta}</span>}
      {next && <span className="ds-badge ds-badge--accent">Сессия · {next}</span>}
    </div>
  );
}
