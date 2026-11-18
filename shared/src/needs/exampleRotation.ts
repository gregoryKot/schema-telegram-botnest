// Ротация примеров потребности («Например» в трекере): из пула показывается окно подряд,
// и новое открытие не пересекается с прошлым — память живёт до перезагрузки страницы.
const lastStart = new Map<string, number>();

/** Начало нового окна: случайное, а при известном прошлом — без общих с ним примеров. */
export function nextExampleStart(
  key: string,
  poolSize: number,
  count: number,
  rand: () => number = Math.random,
): number {
  if (poolSize <= 0) return 0;
  const prev = lastStart.get(key);
  const free = poolSize - 2 * count + 1; // сдвигов, при которых окна не пересекаются
  let start: number;
  if (prev === undefined || prev >= poolSize) start = Math.floor(rand() * poolSize);
  else if (free <= 0) start = (prev + count) % poolSize;
  else start = (prev + count + Math.floor(rand() * free)) % poolSize;
  lastStart.set(key, start);
  return start;
}

/** Окно из `count` примеров подряд, с переходом через конец пула. */
export function exampleWindow<T>(pool: readonly T[], start: number, count: number): T[] {
  const size = Math.min(count, pool.length);
  return Array.from({ length: size }, (_, i) => pool[(start + i) % pool.length]);
}

export function resetExampleRotation(): void {
  lastStart.clear();
}
