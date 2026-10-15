import { useCallback, useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import { paidPhase, POLL_INTERVAL_MS, POLL_LIMIT_MS } from './paidPageModel';

export type PublicBooking = Awaited<ReturnType<typeof api.getBookingByToken>>;

/**
 * Бронь по токену для экрана возврата с оплаты. Пока бронь HELD (вебхук оплаты
 * ещё не пришёл), переспрашивает сервер каждые POLL_INTERVAL_MS; смена статуса
 * подхватывается сама. Через POLL_LIMIT_MS ставит `timedOut` и шлёт отчёт
 * наверх (правило №14: экран-тупик без отчёта — невидимая авария).
 * Ошибка запроса посреди ожидания не сбрасывает уже полученную бронь.
 */
export function useBookingByToken(token: string | null) {
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  // Нет токена → грузить нечего, «загружено» с самого начала.
  const [loaded, setLoaded] = useState(() => !token);
  const [timedOut, setTimedOut] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    const startedAt = Date.now();

    const load = () => {
      api.getBookingByToken(token)
        .then((b) => {
          if (!alive) return;
          pending = paidPhase(b.status) === 'pending';
          setBooking(b);
        })
        .catch(() => { if (alive && !pending) setBooking(null); })
        .finally(() => {
          if (!alive) return;
          setLoaded(true);
          if (!pending) return;
          if (Date.now() - startedAt >= POLL_LIMIT_MS) {
            setTimedOut(true);
            reportClientError({
              message: `booking paid page: бронь осталась HELD через ${POLL_LIMIT_MS / 1000} с после возврата с оплаты`,
              section: 'booking',
            });
            return;
          }
          timer = setTimeout(load, POLL_INTERVAL_MS);
        });
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [token, tick]);

  /** Ручное «обновить»/«проверить ещё раз»: новый цикл ожидания. */
  const reload = useCallback(() => { setTimedOut(false); setTick((t) => t + 1); }, []);

  return { booking, loaded, timedOut, reload };
}
