// «Сервер не отвечает» (RequireAuth): аудит 2026-11 — retrying до ConnectionTrouble не доходил,
// повторное нажатие ничем не отмечалось.
import { useCallback, useState } from 'react';

/** Повтор, который видно: пока обещание не решилось — `retrying`, повторный тап не плодит попыток. */
export function useRetrying(run: () => Promise<unknown>): [boolean, () => void] {
  const [retrying, setRetrying] = useState(false);
  const retry = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    void (async () => { try { await run(); } finally { setRetrying(false); } })(); // refreshToken не бросает
  }, [retrying, run]);
  return [retrying, retry];
}
