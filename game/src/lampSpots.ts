// Фонари вдоль улицы: шаг 540 от x=330; над ямой фонарь не висит — встаёт сразу за ней.
const FIRST = 330, STEP = 540, TAIL = 200, NEAR_PIT = 40, PAST_PIT = 64;

export function lampSpots(arenaW: number, pits: { s: number; e: number }[]): number[] {
  const out: number[] = [];
  for (let x = FIRST; x < arenaW - TAIL; x += STEP) {
    const pit = pits.find(p => x > p.s - NEAR_PIT && x < p.e + NEAR_PIT);
    out.push(pit ? pit.e + PAST_PIT : x);
  }
  return out;
}
