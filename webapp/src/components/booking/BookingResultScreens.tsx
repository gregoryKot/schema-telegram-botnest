import type { RefObject } from 'react';
import type { BookingSlot, SessionOption } from '../../api';
import { localDayLabel, localTimeLabel, submitTimeSuffix } from '../../../../shared/src/booking/clientTimeZone';

/** Терминальные экраны BookingPicker (ожидание оплаты / провал / готово) — вынесены отдельно (правило №10). */
export function AwaitPaymentScreen({ resultRef, slot, tz, chosen, payUrl }: {
  resultRef: RefObject<HTMLDivElement | null>; slot: BookingSlot | null; tz: string;
  chosen: SessionOption | undefined; payUrl: string | null;
}) {
  return (
    <div ref={resultRef} style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>⏳</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>Время зарезервировано</h3>
      {slot && (
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 6px' }}>
          {localDayLabel(slot.startsAt, tz)}, {localTimeLabel(slot.startsAt, tz)} {submitTimeSuffix(tz, new Date(slot.startsAt))} — держу за вами 15 минут.
        </p>
      )}
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>
        Для подтверждения нужна оплата{chosen && chosen.price > 0 ? ` ${chosen.price.toLocaleString('ru-RU')} ₽` : ''}.
      </p>
      <a href={payUrl ?? '#'} style={{ display: 'inline-block', padding: '15px 32px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--r-12)', textDecoration: 'none', boxShadow: 'rgba(var(--accent-rgb),.28) 0 8px 28px' }}>
        Перейти к оплате →
      </a>
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
      <button type="button" onClick={onRetry} style={{ padding: '13px 28px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-12)', cursor: 'pointer' }}>
        Выбрать другое время
      </button>
    </div>
  );
}

export function DoneScreen({ resultRef, slot, tz, cancelled, meetingUrl, cancelToken, onCancel }: {
  resultRef: RefObject<HTMLDivElement | null>; slot: BookingSlot | null; tz: string; cancelled: boolean;
  meetingUrl: string | null; cancelToken: string; onCancel: () => void;
}) {
  return (
    <div ref={resultRef} style={{ textAlign: 'center', padding: '48px 0' }}>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>
        {cancelled ? 'Запись отменена' : 'Время забронировано'}
      </h3>
      {!cancelled && slot && (
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 8px' }}>
          {localDayLabel(slot.startsAt, tz)}, {localTimeLabel(slot.startsAt, tz)} {submitTimeSuffix(tz, new Date(slot.startsAt))}.
        </p>
      )}
      {!cancelled && meetingUrl && (
        <div style={{ margin: '14px auto 4px', maxWidth: 420, padding: '14px 16px', background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid var(--line)', borderRadius: 'var(--r-12)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '0 0 6px' }}>Ваша персональная ссылка на встречу — она же для всех будущих сессий:</p>
          <a href={meetingUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 15, fontWeight: 600, wordBreak: 'break-all', textDecoration: 'none' }}>{meetingUrl}</a>
        </div>
      )}
      {!cancelled && !meetingUrl && (
        <p style={{ color: 'var(--text-faint)', fontSize: 14, margin: '0 0 8px' }}>Пришлю ссылку на встречу до начала сессии.</p>
      )}
      {!cancelled && cancelToken && (
        <button type="button" onClick={onCancel}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
          Отменить запись
        </button>
      )}
    </div>
  );
}
