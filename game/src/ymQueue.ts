/** Вызов Метрики: до загрузки tag.js складывает аргументы в очередь `a`. */
export type YmFn = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

export function makeYmQueue(): YmFn {
  const fn: YmFn = (...args) => { (fn.a = fn.a ?? []).push(args); };
  return fn;
}
