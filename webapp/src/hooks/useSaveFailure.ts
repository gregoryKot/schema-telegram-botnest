import { useCallback, useRef, useState } from 'react';

/**
 * Состояние «последнее сохранение не удалось» для записей «выстрелил и
 * забыл» (оптимистичный локальный стейт + PUT в фоне). track(promise)
 * ставит failed при отказе и сбрасывает при успехе; устаревший ответ
 * (запрос, вытесненный более новым) флаг не трогает.
 */
export function useSaveFailure() {
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);
  const track = useCallback((p: Promise<unknown>, onFail?: (e: unknown) => void) => {
    const mine = ++seq.current;
    p.then(
      () => { if (mine === seq.current) setFailed(false); },
      (e: unknown) => {
        if (mine === seq.current) setFailed(true);
        onFail?.(e);
      },
    );
  }, []);
  const clear = useCallback(() => { seq.current++; setFailed(false); }, []);
  return { failed, track, clear };
}
