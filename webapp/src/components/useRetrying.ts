// «Сервер не отвечает» (RequireAuth): аудит 2026-11 — retrying до ConnectionTrouble не доходил,
// повторное нажатие ничем не отмечалось.
import { useCallback, useState } from 'react';
import { reportClientError } from '../api';

/** Повтор, который видно: пока обещание не решилось — `retrying`, повторный тап не плодит попыток.
 *  Отказ `run` не уходит необработанным: отчёт наверх, `retrying` снимается (сам refreshToken не бросает,
 *  но хук общий — правило №14, экран-тупик шлёт отчёт). */
export function useRetrying(run: () => Promise<unknown>): [boolean, () => void] {
  const [retrying, setRetrying] = useState(false);
  const retry = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    void (async () => {
      try { await run(); } catch (e) {
        reportClientError({ message: `retry failed: ${e instanceof Error ? e.message : String(e)}`, section: 'useRetrying' });
      } finally { setRetrying(false); }
    })();
  }, [retrying, run]);
  return [retrying, retry];
}
