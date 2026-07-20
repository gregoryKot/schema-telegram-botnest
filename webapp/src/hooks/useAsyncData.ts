import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';

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
 *
 * Optional `resetKey`: when it changes, `data` is reset to `initial` (i.e. the
 * loading state) *before* the new fetch resolves, reproducing the old
 * `setX(null); fetch().then(setX)` loading-flash on a dependency switch. The
 * reset happens during render via the react-sanctioned "adjust state when a key
 * changes" pattern, so it is not a set-state-in-effect. Omit it to keep the
 * previous data visible across refetches (no flash).
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  initial: T,
  resetKey?: unknown,
): {
  data: T;
  reload: () => Promise<void>;
  /** Direct setter for optimistic updates (e.g. remove an item before the
   *  server confirms). Safe to call from event handlers. */
  setData: Dispatch<SetStateAction<T>>;
} {
  const [data, setData] = useState<T>(initial);

  // Reset to the loading state when the caller's key changes. Adjusting state
  // during render (not in an effect) is the documented pattern for "derive
  // fresh state when a prop changes" and re-renders immediately with `initial`.
  const [seenKey, setSeenKey] = useState(resetKey);
  if (resetKey !== seenKey) {
    setSeenKey(resetKey);
    setData(initial);
  }

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

  return { data, reload, setData };
}
