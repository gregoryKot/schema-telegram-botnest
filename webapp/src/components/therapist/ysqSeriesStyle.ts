// Стиль линий графика «Динамика топ-5 схем». Цвет линии — цвет домена схемы, и у
// схем одного домена он одинаковый (две фиолетовые, три красные: на телефоне
// их было не отличить, QA 2026-11, T-7). Поэтому внутри домена линии различаются
// штрихом: первая сплошная, дальше пунктир, точки, штрих-точка. Легенда рисует
// образец с тем же штрихом.
export const DASHES = ['', '7 4', '2 3', '9 3 2 3', '4 2 1 2'] as const;

/** Штрих `stroke-dasharray` для каждой схемы списка: номер среди схем того же домена. */
export function seriesDashes(ids: string[], domainOf: (id: string) => string | undefined): Record<string, string> {
  const seen = new Map<string, number>();
  const out: Record<string, string> = {};
  for (const id of ids) {
    const d = domainOf(id) ?? id;
    const k = seen.get(d) ?? 0;
    seen.set(d, k + 1);
    out[id] = DASHES[k % DASHES.length];
  }
  return out;
}

/** Номера подписей оси X, которые оставить, чтобы они не слипались: всегда первая и последняя. */
export function labelIndexes(count: number, max: number): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / (max - 1));
  const keep = new Set<number>([0, count - 1]);
  for (let i = step; i < count - 1; i += step) keep.add(i);
  return [...keep].sort((a, b) => a - b);
}
