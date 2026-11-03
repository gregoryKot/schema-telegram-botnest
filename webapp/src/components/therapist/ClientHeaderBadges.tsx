import type { TherapyClientSummary } from '../../api';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { clientHeaderMeta } from './clientHeaderMeta';
import { isVirtualClient, nextSessionLabel } from './clientSheetHelpers';
import { NextSessionLine } from './NextSessionLine';

/** Шапка клиента: «оффлайн» — плашка, остальное — строка текста; ближайшая встреча — «Встреча» + дата, как в списке клиентов. */
export function ClientHeaderBadges({ client }: { client: TherapyClientSummary }) {
  const meta = clientHeaderMeta(client);
  const next = nextSessionLabel(upcomingSession(client.nextSession, client.meetingDays) ?? '');
  return (
    <div className="tk-badges">
      {isVirtualClient(client) && <span className="ds-badge">оффлайн</span>}
      {meta && <span className="tk-meta">{meta}</span>}
      {next && <NextSessionLine label={next} />}
    </div>
  );
}
