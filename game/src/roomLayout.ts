// Обстановка комнаты (гл.2): где что стоит. Координаты — в px арены, пол — GROUND_Y.
export const WALL_PERIOD = 64; // тайл стены 32 px арта ×2: пятно света встаёт в ту же сетку узора
export const GLOW_W = 384;

export const ROOM = {
  door: 64,
  windows: [704, 1560, 2720, 3648],
  shelves: [544, 2256, 4064],
  plants: [1130, 1900, 3430, 4420],
  desk: 4580,
  pictures: [[256, 0], [1264, 1], [2096, 0], [3440, 1], [4200, 0]] as [x: number, frame: number][],
};

// Левый край пятна света у торшера: по сетке обоев, иначе узор «лит» и «в тени» разъедется.
export const glowLeft = (lampX: number) => Math.round((lampX - GLOW_W / 2) / WALL_PERIOD) * WALL_PERIOD;

// Мебель на полу не ставим над ямой и у самого края арены.
export function onFloor(xs: number[], halfW: number, arenaW: number, pits: { s: number; e: number }[]): number[] {
  return xs.filter(x => x < arenaW - 80 && !pits.some(p => x + halfW > p.s && x - halfW < p.e));
}
