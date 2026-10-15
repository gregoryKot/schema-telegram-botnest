import { useCallback, useEffect, useRef, useState } from 'react';
import { api, reportClientError } from '../../api';
import { ApiError } from '../../apiClient';
import { paidPhase, POLL_INTERVAL_MS, POLL_LIMIT_MS } from './paidPageModel';

export type PublicBooking = Awaited<ReturnType<typeof api.getBookingByToken>>;

/** Почему бронь не загрузилась: сервер её не знает (404) или проверить не вышло. */
export type BookingLoadError = 'notFound' | 'failed';

/** 404 — ссылка не ведёт ни на какую бронь; всё прочее (5xx, 429, сеть, HTML вместо JSON) — сбой. */
export function classifyLoadError(err: unknown): BookingLoadError {
  return err instanceof ApiError && err.status === 404 ? 'notFound' : 'failed';
}

/**
 * Бронь по токену для экрана возврата с оплаты. Пока бронь HELD (вебхук оплаты
 * ещё не пришёл), переспрашивает сервер каждые POLL_INTERVAL_MS; смена статуса
 * подхватывается сама. Через POLL_LIMIT_MS ставит `timedOut` и шлёт отчёт
 * наверх (правило №14: экран-тупик без отчёта — невидимая авария).
 * Ошибка запроса не стирает уже полученную бронь (ни посреди ожидания, ни после
 * «Проверить ещё раз»). Пока брони нет, отказ первой загрузки отдаётся как
 * `loadError`, чтобы страница не рисовала «Оплата принята» без оснований, и
 * уходит наверх один раз за жизнь страницы (ручные «Обновить» не множат отчёты).
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
        .catch((err: unknown) => {
          if (!alive || lastBooking.current) return;
          setLoadError(classifyLoadError(err));
          if (errorReported.current) return;
          errorReported.current = true;
          const detail = err instanceof ApiError ? `HTTP ${err.status}` : err instanceof Error ? err.message : String(err);
          reportClientError({ message: `booking paid page: не удалось загрузить бронь по токену: ${detail}`, section: 'booking' });
        })
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
  const reload = useCallback(() => {
    setTimedOut(false);
    setLoadError(null);
    // Брони нет — вместо пустоты показываем скелетон, пока идёт повторный запрос.
    if (!lastBooking.current) setLoaded(false);
    setTick((t) => t + 1);
  }, []);

  return { booking, loaded, timedOut, loadError, reload };
}
