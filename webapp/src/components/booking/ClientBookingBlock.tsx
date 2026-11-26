import { useState } from 'react';
import type { ClientBookingOverview } from '../../api';
import { useTr } from '../../utils/addressForm';
import { ExternalLink } from '../../host/ExternalLink';
import { useClientTimeZone } from './useClientTimeZone';
import { bookingStatusNote, nextBooking, sessionWhen } from './clientBookingModel';
import { buildClientBookingCopy } from './clientBookingCopy';
import { ClientBookingSheet } from './ClientBookingSheet';
import { SessionTicket } from './SessionTicket';
import '../../styles/client-booking.css';

/**
 * Запись в карточке «Терапевт» профиля (#546): ближайшая своя бронь с
 * «Управлять записью» и кнопка «Записаться на сессию» — только если сервер
 * сказал eligible (клиент владельца практики). Пока ответа нет — ничего:
 * кнопку видят не все клиенты, и силуэт обещал бы то, чего может не быть.
 */
export function ClientBookingBlock({ overview, onBooked, writeUrl }: {
  overview: ClientBookingOverview | null;
  onBooked: () => void;
  writeUrl: string | null;
}) {
  const tr = useTr();
  const copy = buildClientBookingCopy(tr);
  const [tz] = useClientTimeZone();
  const [open, setOpen] = useState(false);
  const next = nextBooking(overview?.upcoming);
  if (!overview || (!overview.eligible && !next)) return null;
  return (
    <div className="cbk-card">
      {next && (
        <SessionTicket className="ym-hide-content" when={sessionWhen(next.startsAt, tz)} label={copy.nextLabel}>
          <span className="cbk-card-status">{bookingStatusNote(next, tz)}</span>
          <ExternalLink href={next.manageUrl} className="ds-link cbk-ticket-link">{copy.manage}</ExternalLink>
        </SessionTicket>
      )}
      {overview.eligible && (
        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setOpen(true)}>{copy.cta}</button>
      )}
      {open && <ClientBookingSheet onClose={() => setOpen(false)} onBooked={onBooked} writeUrl={writeUrl} />}
    </div>
  );
}
