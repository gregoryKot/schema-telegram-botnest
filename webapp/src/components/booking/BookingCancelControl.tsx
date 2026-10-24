import { useState } from 'react';
import { api } from '../../api';
import { ApiError } from '../../apiClient';
import { reportClientError } from '../../api';
import { trackGoal } from '../../lib/metrika';
import { CANCEL_LEAD_HOURS, CANCEL_SUPPORT_LINK, CANCEL_SUPPORT_HANDLE, isPastCancelWindow } from './cancelPolicy';

// Единственная реализация отмены записи клиентом (правило «одна механика —
// один компонент», CLAUDE.md) — раньше DoneScreen глотал ошибку
// (`catch { /* ignore */ }`, docs/INCIDENTS.md 2026-09-29) и BookingPaidPage
// нёс отдельную, полную копию той же логики. Теперь обе площадки берут этот
// компонент.

type Phase = 'idle' | 'confirm' | 'loading';

const linkSt: React.CSSProperties = { color: 'inherit', textDecoration: 'underline' };
const errorSt: React.CSSProperties = { color: 'var(--accent-red)', fontSize: 13, lineHeight: 1.6, margin: '10px 0 0' };

export function BookingCancelControl({ cancelToken, startsAt, onCancelled }: {
  cancelToken: string;
  startsAt: string;
  /** Вызывается после подтверждённой отмены — родитель переключает экран. */
  onCancelled: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);

  // До встречи меньше CANCEL_LEAD_HOURS — онлайн-отмена уже закрыта на
  // бэкенде (booking.service.ts::cancel, CANCEL_TOO_LATE). Кнопку не
  // показываем вовсе, а не даём нажать и молча падать.
  if (isPastCancelWindow(startsAt)) {
    return (
      <p style={{ color: 'var(--text-faint)', fontSize: 13, lineHeight: 1.6, margin: '12px 0 0' }}>
        Отменить онлайн можно не позднее чем за {CANCEL_LEAD_HOURS} часа до встречи.
        Напишите мне в Telegram — решим: <a href={CANCEL_SUPPORT_LINK} style={linkSt}>{CANCEL_SUPPORT_HANDLE}</a>.
      </p>
    );
  }

  const doCancel = async () => {
    setPhase('loading');
    setErrorText(null);
    try {
      await api.cancelBooking(cancelToken);
      trackGoal('booking_cancel');
      onCancelled();
    } catch (err) {
      const tooLate = err instanceof Error && err.message === 'CANCEL_TOO_LATE';
      trackGoal('booking_cancel_error', { reason: tooLate ? 'too_late' : 'server' });
      if (!tooLate) {
        const detail = err instanceof ApiError ? `HTTP ${err.status}` : err instanceof Error ? err.message : String(err);
        reportClientError({ message: `booking cancel failed: ${detail}`, section: 'booking' });
      }
      setErrorText(tooLate ? 'too_late' : 'server');
      setPhase('idle');
    }
  };

  return (
    <div>
      {phase === 'idle' && (
        <button type="button" onClick={() => setPhase('confirm')}
          style={{ padding: '10px 4px', minHeight: 44, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
          Отменить запись
        </button>
      )}
      {phase === 'confirm' && (
        <div style={{ marginTop: 4 }}>
          <p style={{ color: 'var(--text-sub)', fontSize: 14, margin: '0 0 12px' }}>Точно отменить эту встречу?</p>
          <div style={{ display: 'flex', gap: 'var(--space-10)', justifyContent: 'center' }}>
            <button type="button" onClick={doCancel}
              style={{ minHeight: 44, padding: '10px 18px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 'var(--r-10)', border: '1.5px solid var(--accent-red)', background: 'transparent', color: 'var(--accent-red)' }}>
              Да, отменить
            </button>
            <button type="button" onClick={() => setPhase('idle')}
              style={{ minHeight: 44, padding: '10px 18px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 'var(--r-10)', border: '1.5px solid var(--line-strong)', background: 'transparent', color: 'var(--text-sub)' }}>
              Оставить
            </button>
          </div>
        </div>
      )}
      {phase === 'loading' && <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: '4px 0 0' }}>Отменяю…</p>}
      {errorText === 'too_late' && (
        <p style={errorSt}>
          Отменить онлайн можно не позднее чем за {CANCEL_LEAD_HOURS} часа до встречи.
          Напишите мне в Telegram — решим: <a href={CANCEL_SUPPORT_LINK} style={linkSt}>{CANCEL_SUPPORT_HANDLE}</a>.
        </p>
      )}
      {errorText === 'server' && (
        <p style={errorSt}>
          Не получилось отменить. Попробуйте ещё раз или напишите мне в{' '}
          <a href={CANCEL_SUPPORT_LINK} style={linkSt}>Telegram</a>.
        </p>
      )}
    </div>
  );
}
