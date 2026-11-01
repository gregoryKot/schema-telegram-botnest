import { useCallback, useState } from 'react';
import { NEED_ORDER, type NeedId } from '../needs/types';
import {
  defaultChildhoodRatings,
  type ChildhoodRatings,
} from './childhoodWheel';

// Черновик «Колеса детства» на заполнении — общий для сайта и мини-аппа.
// Середина ползунка (5) — только положение, а не ответ: раньше, ничего не
// тронув, человек сохранял 5/5/5/5/5 как свои оценки детства. Теперь
// потребность считается оценённой, только когда её выставили руками;
// сохранённое колесо при открытии оценено целиком (редактирование как было).

/** Потребности, которые ещё не выставлены руками, — в порядке экрана. */
export function unratedNeeds(rated: readonly NeedId[]): NeedId[] {
  return NEED_ORDER.filter((id) => !rated.includes(id));
}

/** Подсказка у недоступной кнопки сохранения: сколько потребностей осталось выставить. */
export function unratedHint(count: number): string {
  return `Ещё не оценено: ${count} из ${NEED_ORDER.length}`;
}

/** Оценки для предпросмотра колеса: неоценённая потребность — пустой сектор, а не пятёрка. */
export function previewRatings(
  ratings: ChildhoodRatings,
  unrated: readonly NeedId[],
): ChildhoodRatings {
  const out = { ...ratings };
  for (const id of unrated) out[id] = 0;
  return out;
}

export function useChildhoodDraft(
  initial?: ChildhoodRatings,
  hasSaved = false,
) {
  const [ratings, setRatings] = useState<ChildhoodRatings>(
    () => initial ?? defaultChildhoodRatings(),
  );
  const [rated, setRated] = useState<NeedId[]>(() =>
    hasSaved ? [...NEED_ORDER] : [],
  );

  const rate = useCallback((id: NeedId, v: number) => {
    setRatings((r) => ({ ...r, [id]: v }));
    setRated((r) => (r.includes(id) ? r : [...r, id]));
  }, []);

  /** Подставить пришедшие с сервера (или отменить правку): сохранённое — оценено целиком. */
  const load = useCallback((next: ChildhoodRatings, saved: boolean) => {
    setRatings(next);
    setRated(saved ? [...NEED_ORDER] : []);
  }, []);

  return { ratings, rated, unrated: unratedNeeds(rated), rate, load };
}
