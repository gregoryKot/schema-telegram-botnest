import type { RefObject } from 'react';
import type { BookingSlot } from '../../api';
import { localDayLabel, localTimeLabel, submitTimeSuffix } from '../../../../shared/src/booking/clientTimeZone';
import { BookingCancelControl } from './BookingCancelControl';
import { BookingSaveBlock, MEETING_LINK_LATER } from './BookingSaveBlock';
import { BookingCrisisNote } from './BookingCrisisNote';
import { Btn } from '../landing-kit';

/** Терминальные экраны BookingPicker (ожидание оплаты / провал / готово) — вынесены отдельно (правило №10). */
export function AwaitPaymentScreen({ resultRef, slot, tz, priceText, payUrl, message }: {
  resultRef: RefObject<HTMLDivElement | null>; slot: BookingSlot | null; tz: string; priceText: string | null; payUrl: string | null; message: string;
}) {
  return (
    <div ref={resultRef} className="ym-hide-content" style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>⏳</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>Время зарезервировано</h3>
      {slot && (
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 6px' }}>
          {localDayLabel(slot.startsAt, tz)}, {localTimeLabel(slot.startsAt, tz)} {submitTimeSuffix(tz)} — держу за вами 15 минут.
        </p>
      )}
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>
        Для подтверждения нужна оплата{priceText ? ` ${priceText}` : ''}.
      </p>
      <Btn href={payUrl ?? '#'} newTab={false} radius="btn" size="lg">Перейти к оплате →</Btn>
      <BookingCrisisNote text={message} />
      <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '20px auto 0', maxWidth: 420 }}>
        Если оплата не открылась или возникла ошибка — не волнуйтесь: я уже вижу вашу заявку и свяжусь с вами в Telegram. Можно также написать напрямую: <a href="https://t.me/kotlarewski" className="u-accent">@kotlarewski</a>.
      </p>
    </div>
  );
}

export function PaymentFailScreen({ resultRef, onRetry }: { resultRef: RefObject<HTMLDivElement | null>; onRetry: () => void }) {
  return (
    <div ref={resultRef} style={{ textAlign: 'center', padding: '48px 0' }}>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>Оплата не прошла</h3>
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>Время снова свободно. Выберите другое или напишите напрямую.</p>
      <Btn onClick={onRetry} radius="btn" size="lg">Выбрать другое время</Btn>
    </div>
  );
}

export function DoneScreen({ resultRef, slot, tz, cancelled, cancelToken, sessionType, onCancelled, message, costNote }: {
  resultRef: RefObject<HTMLDivElement | null>; slot: BookingSlot | null; tz: string; cancelled: boolean;
  cancelToken: string; sessionType: 'INTRO_15' | 'SESSION_50'; onCancelled: () => void; message: string; costNote?: string | null;
}) {
  return (
    <div ref={resultRef} className="ym-hide-content" style={{ textAlign: 'center', padding: '48px 0' }}>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>
        {cancelled ? 'Запись отменена' : sessionType === 'INTRO_15' ? 'Заявка принята' : 'Время забронировано'}
      </h3>
      {!cancelled && slot && (
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 8px' }}>
          {localDayLabel(slot.startsAt, tz)}, {localTimeLabel(slot.startsAt, tz)} {submitTimeSuffix(tz)}.
        </p>
      )}
      {!cancelled && sessionType === 'INTRO_15' && (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, lineHeight: 1.6, margin: '0 0 8px' }}>
          Напишу вам, чтобы подтвердить встречу. Не получили сообщения за 3 часа до встречи – напишите мне:{' '}
          <a href="https://t.me/kotlarewski" className="u-accent">@kotlarewski</a>. Без подтверждения встреча не состоится.
        </p>
      )}
      {!cancelled && costNote && <p style={{ color: 'var(--text-sub)', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px' }}>{costNote}</p>}
      {!cancelled && <p style={{ color: 'var(--text-faint)', fontSize: 14, margin: '0 0 8px' }}>{MEETING_LINK_LATER}</p>}
      {!cancelled && <BookingCrisisNote text={message} />}
      {!cancelled && cancelToken && slot && (
        <BookingSaveBlock
          cancelToken={cancelToken} startsAt={slot.startsAt} durationMin={slot.durationMin}
          type={sessionType} tz={tz}
        />
      )}
      {!cancelled && cancelToken && slot && (
        <div style={{ marginTop: 12 }}>
          <BookingCancelControl cancelToken={cancelToken} startsAt={slot.startsAt} onCancelled={onCancelled} />
        </div>
      )}
    </div>
  );
}
