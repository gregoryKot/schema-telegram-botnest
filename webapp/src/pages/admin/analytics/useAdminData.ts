import { useCallback, useEffect, useState } from 'react';

interface Settled<T> { key: string; data: T | null; error: string | null }

/** Загрузка с «Повторить»: «загружается» = ответ ещё не по текущему ключу, поздний ответ по старому не применяется. */
export function useAdminData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}|${deps.map(String).join('|')}`;
  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => { if (!cancelled) setSettled({ key, data, error: null }); },
      (e: unknown) => { if (!cancelled) setSettled({ key, data: null, error: e instanceof Error ? e.message : 'Не удалось загрузить данные' }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const fresh = settled?.key === key ? settled : null;
  return { data: fresh?.data ?? null, error: fresh?.error ?? null, loading: !fresh, retry };
}
