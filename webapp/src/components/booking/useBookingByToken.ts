import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { handleLoadFailure, reportHeldTimeout, type BookingLoadError } from './bookingLoadError';
import { paidPhase, POLL_INTERVAL_MS, POLL_LIMIT_MS } from './paidPageModel';

export type PublicBooking = Awaited<ReturnType<typeof api.getBookingByToken>>;

/**
 * Бронь по токену для экрана возврата с оплаты. Пока бронь HELD, переспрашивает
 * сервер каждые POLL_INTERVAL_MS; через POLL_LIMIT_MS ставит `timedOut`. Отказ
 * запроса не стирает уже полученную бронь; пока брони нет, отдаётся `loadError`.
 */
export function useBookingByToken(token: string | null) {
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  // Нет токена → грузить нечего, «загружено» с самого начала.
  const [loaded, setLoaded] = useState(() => !token);
  const [timedOut, setTimedOut] = useState(false);
  const [loadError, setLoadError] = useState<BookingLoadError | null>(null);
  const [tick, setTick] = useState(0);
  const lastBooking = useRef<PublicBooking | null>(null);
  const errorReported = useRef(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Новый цикл после «Проверить ещё раз» продолжает ждать, если бронь была HELD.
    let pending = !!lastBooking.current && paidPhase(lastBooking.current.status) === 'pending';
    const startedAt = Date.now();

    const load = () => {
      api.getBookingByToken(token)
        .then((b) => {
          if (!alive) return;
          pending = paidPhase(b.status) === 'pending';
          lastBooking.current = b;
          setBooking(b);
          setLoadError(null);
        })
        .catch((err: unknown) => { if (alive && !lastBooking.current) setLoadError(handleLoadFailure(err, errorReported)); })
        .finally(() => {
          if (!alive) return;
          setLoaded(true);
          if (!pending) return;
          if (Date.now() - startedAt >= POLL_LIMIT_MS) { setTimedOut(true); reportHeldTimeout(); return; }
          timer = setTimeout(load, POLL_INTERVAL_MS);
        });
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [token, tick]);

  /** «Обновить»/«проверить ещё раз»: новый цикл; без брони — скелетон, пока идёт повторный запрос. */
  const reload = useCallback(() => { setTimedOut(false); setLoadError(null); if (!lastBooking.current) setLoaded(false); setTick((t) => t + 1); }, []);

  return { booking, loaded, timedOut, loadError, reload };
}
