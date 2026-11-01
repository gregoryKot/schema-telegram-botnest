import { useCallback, useRef, useState } from 'react';

/**
 * Состояние «последнее сохранение не удалось» для записей «выстрелил и
 * забыл» (оптимистичный локальный стейт + PUT в фоне). track(promise)
 * ставит failed при отказе и сбрасывает при успехе; устаревший ответ
 * (запрос, вытесненный более новым) флаг не трогает. error — причина отказа
 * (409 «не читается» из shared/src/api/unwritableError.ts ≠ обрыв связи). */
export function useSaveFailure() {
  const [last, setLast] = useState<{ error: unknown } | null>(null);
  const seq = useRef(0);
  const track = useCallback((p: Promise<unknown>, onFail?: (e: unknown) => void) => {
    const mine = ++seq.current;
    p.then(
      () => { if (mine === seq.current) setLast(null); },
      (e: unknown) => {
        if (mine === seq.current) setLast({ error: e });
        onFail?.(e);
      },
    );
  }, []);
  const clear = useCallback(() => { seq.current++; setLast(null); }, []);
  return { failed: last !== null, error: last?.error, track, clear };
}
