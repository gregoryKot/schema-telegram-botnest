/** Кэш промиса, который не запоминает неудачу: пустой результат — повтор на следующем вызове. */
export function cachedUnlessEmpty<T>(
  load: () => Promise<T>,
  isEmpty: (v: T) => boolean,
): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => {
    if (!cached) {
      const p = load().then((v) => {
        if (isEmpty(v) && cached === p) cached = null;
        return v;
      });
      cached = p;
    }
    return cached;
  };
}
