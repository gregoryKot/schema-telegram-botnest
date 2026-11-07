import { useEffect, useRef, useState } from 'react';
import { useLocalDay } from '../utils/useLocalDay';
import { shiftCalendarDay } from '../utils/calendarDate';
import { pendingRatingsFor } from '../utils/ratingOutbox';
import { markCelebrated } from '../utils/todayConstants';

// Оценки потребностей «сегодня» и «вчера» для экрана дня — одна механика для
// сайта (useBootstrapLoad) и мини-аппа (App.tsx), до QA 2026-11-03 жила двумя
// копиями с тремя одинаковыми ошибками:
// - К2: «сегодня» запрашивалось без даты, и сервер отдавал СВОЙ день (пояс
//   уведомлений, по умолчанию Москва), а оценки писались днём устройства. В
//   Лос-Анджелесе днём плитка показывала «Ещё не заполнен» при пяти оценках в
//   БД. Теперь день — всегда устройства, явной датой, как и для «вчера».
// - К3: день вычислялся при загрузке бандла. В полночь открытая вкладка
//   продолжала показывать вчерашние оценки как сегодняшние. Теперь при смене
//   дня оценки сбрасываются и перечитываются.
// - З9: чтение обгоняло выгрузку офлайн-очереди — «1 из 5» после перезагрузки
//   при 5 из 5 в БД. Теперь очередь этого дня кладётся поверх ответа сервера.

type Ratings = Record<string, number>;

export interface DayRatingsApi<N> {
  needs(): Promise<N[]>;
  ratings(date: string): Promise<Ratings>;
}

export interface DayRatingsHandlers<N> {
  /** Первая загрузка дня пришла (не зовётся при перечитывании в полночь). */
  onLoaded?(data: {
    needs: N[];
    ratings: Ratings;
    yesterdayRatings: Ratings;
  }): void;
  /** `initial` — упала первая загрузка экрана, а не перечитывание в полночь. */
  onError?(e: unknown, initial: boolean): void;
}

const allTrue = (r: Ratings) =>
  Object.fromEntries(Object.keys(r).map((k) => [k, true]));

export function useDayRatings<N extends { id: string }>(
  api: DayRatingsApi<N>,
  handlers: DayRatingsHandlers<N> = {},
) {
  const today = useLocalDay();
  const [needs, setNeeds] = useState<N[]>([]);
  const [ratings, setRatings] = useState<Ratings>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [yesterdayRatings, setYesterdayRatings] = useState<Ratings>({});
  const [loading, setLoading] = useState(true);

  // День сменился — вчерашние оценки уходят с экрана сразу, в том же рендере,
  // а не после ответа сервера: иначе правка в эту секунду легла бы в новый
  // день одной оценкой, а экран показывал бы пять.
  const [ratingsDay, setRatingsDay] = useState(today);
  if (ratingsDay !== today) {
    setRatingsDay(today);
    setRatings({});
    setSaved({});
    setYesterdayRatings({});
  }

  const latest = useRef({ api, handlers });
  useEffect(() => {
    latest.current = { api, handlers };
  });
  const firstLoad = useRef(true);

  useEffect(() => {
    let alive = true;
    let settled = false;
    const initial = firstLoad.current;
    firstLoad.current = false;
    const { api: a } = latest.current;
    const yesterday = shiftCalendarDay(today, -1);
    // Снимок очереди — до запроса (см. pendingRatingsFor).
    const pendingToday = pendingRatingsFor(today);
    const pendingYesterday = pendingRatingsFor(yesterday);
    Promise.all([a.needs(), a.ratings(today), a.ratings(yesterday)])
      .then(([n, r, yR]) => {
        if (!alive) return;
        const day = { ...r, ...pendingToday };
        const prevDay = { ...yR, ...pendingYesterday };
        setNeeds(n);
        // Ответы, данные пока шёл запрос, свежее ответа сервера.
        setRatings((prev) => ({ ...day, ...prev }));
        setSaved((prev) => ({ ...allTrue(day), ...prev }));
        setYesterdayRatings(prevDay);
        if (n.length > 0 && n.every((need) => day[need.id] !== undefined)) {
          markCelebrated(today);
        }
        if (initial)
          latest.current.handlers.onLoaded?.({
            needs: n,
            ratings: day,
            yesterdayRatings: prevDay,
          });
      })
      .catch((e: unknown) => {
        if (alive) latest.current.handlers.onError?.(e, initial);
      })
      .finally(() => {
        settled = true;
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      // StrictMode снимает эффект до ответа: первая загрузка ещё впереди.
      if (initial && !settled) firstLoad.current = true;
    };
  }, [today]);

  return {
    today,
    needs,
    ratings,
    setRatings,
    saved,
    setSaved,
    yesterdayRatings,
    loading,
  };
}
