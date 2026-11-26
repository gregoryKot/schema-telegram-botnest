// Геометрия колеса потребностей — одна на само колесо (NeedsWheel) и его силуэт загрузки
// (webapp HistorySheetSkeleton): силуэт того же диаметра и с теми же секторами, и при появлении
// данных форма не прыгает (правило «скелетон по форме контента»).

export const W = 360,
  H = 280,
  CX = W / 2,
  CY = H / 2,
  R = CY - 20,
  CENTER_R = 41;
const SPREAD = (34 * Math.PI) / 180;

const point = (r: number, a: number) =>
  `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;

/** Сектор (лепесток) радиуса r вокруг угла ca; меньше пикселя — пусто. */
export function petalPath(r: number, ca: number): string {
  if (r < 1) return '';
  return `M ${CX} ${CY} L ${point(r, ca - SPREAD)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${point(r, ca + SPREAD)} Z`;
}

/** Дуга-линейка сектора на радиусе r. */
export function arcPath(r: number, ca: number): string {
  return `M ${point(r, ca - SPREAD)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${point(r, ca + SPREAD)}`;
}

/** Угол i-го сектора из n: первый — сверху, дальше по часовой. */
export const wheelAngle = (i: number, n: number) =>
  -Math.PI / 2 + (2 * Math.PI * i) / n;

/** Полные секторы колеса из n потребностей — фон колеса и силуэт загрузки. */
export function wheelSectors(n: number): string[] {
  return Array.from({ length: n }, (_, i) => petalPath(R, wheelAngle(i, n)));
}
