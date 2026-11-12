// Порядок плиток-счётчиков «Моего пути»: шесть самых частых занятий, но соседи (по горизонтали и
// вертикали в сетке 2 и 3 колонки) — оттенками бумаги не ближе 40° по кругу (APP_2026-11.md, принцип
// соседей): «Дни с трекером» 70 и «Заметки дня» 45 рядом сливались. Перебор 6! перестановок — дёшево.

/** Пары соседних клеток в сетке cols колонок для n клеток (индексы по строкам). */
function gridPairs(n: number, cols: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if ((i + 1) % cols !== 0 && i + 1 < n) pairs.push([i, i + 1]);
    if (i + cols < n) pairs.push([i, i + cols]);
  }
  return pairs;
}

const gap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

function permutations(n: number): number[][] {
  if (n <= 1) return [[...Array(n).keys()]];
  return permutations(n - 1).flatMap((p) =>
    Array.from({ length: n }, (_, i) => [
      ...p.slice(0, i),
      n - 1,
      ...p.slice(i),
    ]),
  );
}

export const MIN_NEIGHBOR_GAP = 40;

/** Плитки в порядке, где меньше всего соседей ближе MIN_NEIGHBOR_GAP; при равенстве — ближе к
 *  исходному порядку (по убыванию числа). Без оттенка (незнакомое занятие) — соседство не считается. */
export function spreadStatTiles<T>(
  tiles: readonly T[],
  hueOf: (t: T) => number | undefined,
): T[] {
  const n = tiles.length;
  if (n < 2 || n > 6) return [...tiles];
  const pairs = [...gridPairs(n, 2), ...gridPairs(n, 3)];
  let best: number[] = [...Array(n).keys()];
  let bestScore = [Infinity, Infinity];
  for (const perm of permutations(n)) {
    const hues = perm.map((i) => hueOf(tiles[i]));
    const close = pairs.filter(
      ([a, b]) =>
        hues[a] !== undefined &&
        hues[b] !== undefined &&
        gap(hues[a], hues[b]) < MIN_NEIGHBOR_GAP,
    ).length;
    const drift = perm.reduce((s, orig, pos) => s + Math.abs(orig - pos), 0);
    if (
      close < bestScore[0] ||
      (close === bestScore[0] && drift < bestScore[1])
    ) {
      best = perm;
      bestScore = [close, drift];
    }
  }
  return best.map((i) => tiles[i]);
}
