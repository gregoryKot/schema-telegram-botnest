import { useEffect, useState } from 'react';
import { api, type BookingSlot, type ClientBookResult } from '../../api';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { ExternalLink } from '../../host/ExternalLink';
import { Skeleton } from '../Skeleton';
import { handleBookingFailure, type BookingFailure } from '../bookingFailure';
import { firstSlotDay, useBookingSlots } from '../../../../shared/src/booking/useBookingSlots';
import { localTimeLabel } from '../../../../shared/src/booking/clientTimeZone';
import { BookingSlotsSection } from './BookingSlotsSection';
import { useClientTimeZone } from './useClientTimeZone';
import { useClientSessionPrice } from './useClientSessionPrice';
import { ClientBookingPrice } from './ClientBookingPrice';
import { bookOutcome, sessionWhen } from './clientBookingModel';
import { buildClientBookingCopy } from './clientBookingCopy';
import '../../styles/client-booking.css';

type Phase =
  | { kind: 'pick' }
  | { kind: 'sending' }
  | { kind: 'failed'; why: BookingFailure }
  | { kind: 'pay' | 'done'; res: ClientBookResult; startsAt: string };

/**
 * Лист «Запись на сессию» из «Мой терапевт» (#546): свободные окна календаря
 * терапевта (тот же GET /api/booking/slots и тот же выбор дня и времени, что
 * у записи на визитке), одно действие «Записаться на HH:mm», затем оплата или
 * «Записано». Без формы: имя и контакт сервер берёт из аккаунта, оферта
 * принимается нажатием — строка с условиями стоит прямо у кнопки.
 */
export function ClientBookingSheet({ onClose, onBooked, writeUrl }: {
  onClose: () => void;
  /** Бронь создана — карточка терапевта перечитывает «Ближайшая сессия». */
  onBooked: () => void;
  /** Чат с терапевтом (tg://…); null — канала нет. */
  writeUrl: string | null;
}) {
  const goBack = useHistorySheet(onClose);
  const tr = useTr();
  const copy = buildClientBookingCopy(tr);
  const [tz, setTz] = useClientTimeZone();
  const { slots, failed } = useBookingSlots(api.getSlots);
  const { price, explicit } = useClientSessionPrice(tz); // тот же пояс и выбор валюты (Р5) уходят в запись
  const [pickedDay, setDay] = useState('');
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  useEffect(() => { api.trackEvent('client_booking_opened'); }, []);
  const day = pickedDay || firstSlotDay(slots, tz);
  // Новый выбор времени снимает прошлую ошибку («время заняли» относилось к другому слоту).
  const pick = (s: BookingSlot) => { setSlot(s); setPhase({ kind: 'pick' }); };

  const submit = async () => {
    if (!slot) return;
    setPhase({ kind: 'sending' });
    try {
      const res = await api.clientBook({ startsAt: slot.startsAt, durationMin: slot.durationMin, clientTimeZone: tz, currency: explicit });
      onBooked();
      setPhase({ kind: bookOutcome(res), res, startsAt: slot.startsAt });
    } catch (err) {
      setPhase({ kind: 'failed', why: handleBookingFailure(err) });
    }
  };

  const write = writeUrl && <ExternalLink href={writeUrl} className="ds-link">{copy.write}</ExternalLink>;
  let body: React.ReactNode;
  if (phase.kind === 'pay' || phase.kind === 'done') {
    body = (
      <section className="cbk-result ym-hide-content" aria-live="polite">
        <h2 className="ds-h3">{phase.kind === 'pay' ? copy.payTitle : copy.doneTitle}: {sessionWhen(phase.startsAt, tz)}</h2>
        {phase.kind === 'pay' && <p className="cbk-note">{copy.payNote}</p>}
        {phase.kind === 'pay' && phase.res.paymentUrl && (
          <ExternalLink href={phase.res.paymentUrl} className="ds-btn ds-btn--lg">{copy.pay}</ExternalLink>
        )}
        <p className="cbk-note">{copy.manageNote}</p>
        <ExternalLink href={phase.res.manageUrl} className="ds-link">{copy.manage}</ExternalLink>
      </section>
    );
  } else if (failed) {
    body = <p className="cbk-note" role="alert">{copy.loadFailed}</p>;
  } else if (slots === null) {
    body = <SlotsSkeleton />;
  } else if (slots.length === 0) {
    body = <div className="cbk-actions"><p className="cbk-note">{copy.empty}</p>{write}</div>;
  } else {
    body = (
      <>
        <BookingSlotsSection slots={slots} tz={tz} onTzChange={setTz} day={day} onDayChange={setDay} slot={slot} onSlotChange={pick} tr={tr} />
        <ClientBookingPrice tz={tz} tr={tr} price={price} />
        {phase.kind === 'failed' && (
          <p className="cbk-error" role="alert">{phase.why === 'taken' ? copy.taken : copy.failed}</p>
        )}
        {phase.kind === 'failed' && phase.why === 'error' && write}
        {slot ? (
          <div className="cbk-actions">
            <p className="cbk-offer">
              {copy.offerLead}<ExternalLink href="/offer" className="u-link">оферты</ExternalLink> и{' '}
              <ExternalLink href="/privacy" className="u-link">политики конфиденциальности</ExternalLink>.
            </p>
            <button type="button" className="ds-btn ds-btn--lg" disabled={phase.kind === 'sending'} onClick={() => void submit()}>
              {phase.kind === 'sending' ? copy.sending : copy.submit(localTimeLabel(slot.startsAt, tz))}
            </button>
          </div>
        ) : (
          <p className="cbk-note">{copy.pickTime}</p>
        )}
      </>
    );
  }

  return (
    <div className="u-sheet cbk-sheet" role="dialog" aria-modal="true" aria-label={copy.title}>
      <div className="ds-sheet-head ds-sheet-head--page cbk-head">
        <button type="button" className="ds-back" onClick={goBack}>{copy.close}</button>
      </div>
      <div className="cbk-inner">
        <header>
          <div className="ds-eyebrow">Мой терапевт</div>
          <h1 className="ds-h1">{copy.title}</h1>
        </header>
        <p className="cbk-lede">{copy.lede}</p>
        {body}
      </div>
    </div>
  );
}

/** Силуэт ленты слотов: строка дней и сетка времени — по форме BookingSlotsSection. */
function SlotsSkeleton() {
  return (
    <div className="cbk-skel" aria-hidden>
      <Skeleton width="40%" height={12} />
      <div className="cbk-skel-row">{[0, 1, 2, 3].map((i) => <Skeleton key={i} width={88} height={44} radius={999} />)}</div>
      <Skeleton width="30%" height={12} />
      <div className="cbk-skel-row">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} width={72} height={44} radius={999} />)}</div>
    </div>
  );
}
