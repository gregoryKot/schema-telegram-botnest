import { useEffect, useState } from 'react';
import { api, type BookingSlot, type ClientBookResult } from '../../api';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useDialogA11y } from '../../../../shared/src/utils/dialogA11y';
import { glue } from '../../../../shared/src/utils/typo';
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
import { bookOutcome, leadAndRest, sessionWhen } from './clientBookingModel';
import { EntitySheet } from '../paper/EntitySheet';
import { PaperAlert } from '../paper/PaperAlert';
import { PaperEmpty } from '../art/PaperEmpty';
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
  const dialogA11y = useDialogA11y(); // фокус на «Закрыть», Tab внутри листа, возврат к кнопке записи
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

  const writeLink = (cls: string) => writeUrl && <ExternalLink href={writeUrl} className={cls}>{copy.write}</ExternalLink>;
  const write = writeLink('ds-link');
  let body: React.ReactNode;
  if (phase.kind === 'pay' || phase.kind === 'done') {
    body = (
      <section className="cbk-result ym-hide-content" aria-live="polite">
        <h2 className="ds-h3">{phase.kind === 'pay' ? copy.payTitle : copy.doneTitle}: {sessionWhen(phase.startsAt, tz)}</h2>
        {phase.kind === 'pay' && <p className="cbk-note">{glue(copy.payNote)}</p>}
        {phase.kind === 'pay' && phase.res.paymentUrl && (
          <ExternalLink href={phase.res.paymentUrl} className="ds-btn ds-btn--lg">{copy.pay}</ExternalLink>
        )}
        <p className="cbk-note">{glue(copy.manageNote)}</p>
        <ExternalLink href={phase.res.manageUrl} className="ds-link">{copy.manage}</ExternalLink>
      </section>
    );
  } else if (failed) {
    body = <FailNote text={copy.loadFailed} />;
  } else if (slots === null) {
    body = <SlotsSkeleton />;
  } else if (slots.length === 0) {
    body = <div className="cbk-actions cbk-empty"><PaperEmpty>{glue(copy.empty)}</PaperEmpty>{writeLink('ds-btn ds-btn--secondary cbk-empty-write')}</div>;
  } else {
    body = (
      <>
        <BookingSlotsSection paper slots={slots} tz={tz} onTzChange={setTz} day={day} onDayChange={setDay} slot={slot} onSlotChange={pick} tr={tr} />
        <ClientBookingPrice tz={tz} tr={tr} price={price} when={slot ? sessionWhen(slot.startsAt, tz) : undefined} />
        {phase.kind === 'failed' && <FailNote text={phase.why === 'taken' ? copy.taken : copy.failed} />}
        {phase.kind === 'failed' && phase.why === 'error' && write}
        {slot ? (
          <div className="cbk-actions">
            <button type="button" className="ds-btn ds-btn--lg" disabled={phase.kind === 'sending'} onClick={() => void submit()}>
              {phase.kind === 'sending' ? copy.sending : copy.submit(localTimeLabel(slot.startsAt, tz))}
            </button>
            <p className="cbk-offer">
              {glue(copy.offerLead)}<ExternalLink href="/offer" className="u-link">оферты</ExternalLink> и{' '}
              <ExternalLink href="/privacy" className="u-link">политики конфиденциальности</ExternalLink>.
            </p>
          </div>
        ) : (
          <p className="cbk-note">{glue(copy.pickTime)}</p>
        )}
      </>
    );
  }

  return (
    <div {...dialogA11y} className="u-sheet cbk-sheet" aria-label={copy.title}>
      <div className="ds-sheet-head ds-sheet-head--page cbk-head">
        <button type="button" className="ds-back" onClick={goBack}>{copy.close}</button>
      </div>
      <div className="cbk-inner">
        <EntitySheet look="therapist" compact titleAs="h1" label="Мой терапевт" title={copy.title} sub={copy.lede} />
        {body}
      </div>
    </div>
  );
}

/** Сбой строкой: первая фраза — заголовком, продолжение — тише (PaperAlert); слова те же. */
function FailNote({ text }: { text: string }) {
  const [lead, rest] = leadAndRest(text);
  return <PaperAlert sign="talk" title={lead} text={rest || undefined} />;
}

/** Силуэт ленты слотов по форме BookingSlotsSection: чипы дня (лента), две строки про часовой пояс, чипы времени
 *  той же ширины и скругления, что настоящие (перенос ряда совпадает на любой ширине), строка цены. */
function SlotsSkeleton() {
  return (
    <div className="cbk-skel" aria-hidden>
      <Skeleton width={96} height={12} />
      <div className="cbk-skel-row cbk-skel-row--days">{[0, 1, 2, 3].map((i) => <Skeleton key={i} width={130} height={44} radius={8} />)}</div>
      <Skeleton width={56} height={12} style={{ marginTop: 12 }} />
      <div className="cbk-skel-tz"><Skeleton width={230} height={10} /><Skeleton width={150} height={10} /></div>
      <div className="cbk-skel-row">{[0, 1, 2, 3].map((i) => <Skeleton key={i} width={88} height={44} radius={8} />)}</div>
      <Skeleton width="70%" height={14} style={{ marginTop: 12 }} />
    </div>
  );
}
