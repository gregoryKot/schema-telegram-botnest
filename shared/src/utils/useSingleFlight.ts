// Действие, которое нельзя запустить второй раз, пока первое в полёте.
// `disabled` у кнопки этого не держит: двойной Enter или два тапа в одном
// кадре видят один и тот же рендер, где запрос ещё не начат. QA 2026-11:
// двойной Enter в поле имени создавал двух клиентов (useAddClient обоих
// фронтендов). Флаг — на ref, а не на state, как в useYsqRequest и
// useSavingAction: ref меняется синхронно, до следующего рендера.
// Один флаг на все обёрнутые действия хука: пока идёт одно, второе — no-op.
import { useCallback, useRef } from 'react';

export function useSingleFlight() {
  const inFlight = useRef(false);
  return useCallback(
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R | undefined> => {
        if (inFlight.current) return undefined;
        inFlight.current = true;
        try {
          return await fn(...args);
        } finally {
          inFlight.current = false;
        }
      },
    [],
  );
}
