import { useState, useEffect, useCallback } from 'react';

/**
 * Small data-layer hook: runs an async `fetcher` on mount and whenever the
 * (memoised) fetcher identity changes, storing its result in state. Returns the
 * data plus a `reload` for manual refresh after a mutation.
 *
 * Why it exists: it replaces the repeated
 * `const reload = useCallback(async () => setX(await api...), [dep]);`
 * `useEffect(() => { reload(); }, [reload]);`
 * pattern that react-compiler's `set-state-in-effect` rule flags (the
 * `setX(await …)` shape reads as a synchronous set). The effect here is written
 * in the canonical subscribe/cleanup form — async work guarded by an `alive`
 * flag with a cleanup that cancels the stale write — so no eslint-disable is
 * needed and an unmount mid-flight can't set state on a dead component.
 *
 * Caller MUST pass a STABLE `fetcher` (wrap it in `useCallback`) — its identity
 * is the effect's only dependency; an inline arrow would refetch every render.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  initial: T,
): { data: T; reload: () => Promise<void> } {
  const [data, setData] = useState<T>(initial);

  // Manual refresh after mutations. setState lives in a plain callback (not an
  // effect), so it is not subject to set-state-in-effect. Errors are swallowed
  // to match the previous fire-and-forget reload() behaviour (data unchanged).
  const reload = useCallback(
    () => fetcher().then(setData).catch(() => undefined),
    [fetcher],
  );

  useEffect(() => {
    let alive = true;
    fetcher()
      .then((d) => { if (alive) setData(d); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [fetcher]);

  return { data, reload };
}
