import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api';
import {
  readSavedRatings,
  type ChildhoodRatings,
} from '../../../../../shared/src/childhoodWheel/childhoodWheel';

export type SavedChildhood =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; ratings: ChildhoodRatings; hasSaved: boolean };

/**
 * Сохранённое колесо детства с сервера. Колесо не показывает ползунки,
 * пока ответ не пришёл: иначе экран стартовал бы с пятёрок и «Посмотреть
 * результат» перезаписал бы настоящие ответы середины шкалы (потеря данных).
 */
export function useSavedChildhood() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SavedChildhood>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    api
      .getChildhoodRatings()
      .then((saved) => {
        if (alive) setState({ status: 'ready', ...readSavedRatings(saved) });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  return { state, retry };
}
