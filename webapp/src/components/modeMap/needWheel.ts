import type { ModeMapNode } from '../../api';
import { NEED_ORDER } from '../../../../shared/src/needs/needData';
import { CX, CY, H, R, W, wheelAngle } from '../../../../shared/src/components/needsWheelGeometry';

// Колесо потребностей на холсте (владелец 2026-11-10, лист Farrell & Shaw «Как эти
// потребности удовлетворялись в детстве, в подростковом возрасте и сейчас»): у каждой
// из пяти потребностей — оценка 0–10 и текст по трём периодам. Шкала та же, что у
// упражнения «Колесо детства» и колеса дня (ChildhoodRating, NeedsWheel), на холсте
// она читается процентами. Чистые функции: данные узла, подписи, геометрия секторов.

export type WheelPeriod = 'child' | 'teen' | 'now';
export type WheelData = NonNullable<ModeMapNode['data']['wheel']>;

export const PERIODS: { id: WheelPeriod; label: string; center: string; note: string }[] = [
  { id: 'child', label: 'Детство', center: 'детство', note: 'Детский опыт, связанный с потребностью' },
  { id: 'teen', label: '11–17 лет', center: '11–17', note: 'Подростковый опыт, связанный с потребностью' },
  { id: 'now', label: 'Сейчас', center: 'сейчас', note: 'Как сейчас старается её удовлетворить' },
];

/** Клик по сектору на холсте: панель колеса открывает эту потребность (WheelFields слушает событие). */
export const WHEEL_NEED_EVENT = 'modemap-wheel-need';

/** Узел «needs» — колесо, а не старый круг с таблетками внутри. */
export const isWheel = (d: { wheel?: unknown } | undefined): boolean => !!d?.wheel;

export const wheelPeriod = (w: WheelData | undefined): WheelPeriod => w?.period ?? 'now';

const isRating = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10;

/** Оценки периода, только выставленные (неоценённая потребность — пустой сектор, а не ноль). */
export function ratingsOf(w: WheelData | undefined, period: WheelPeriod): Record<string, number> {
  const src = w?.ratings?.[period] ?? {};
  return Object.fromEntries(NEED_ORDER.filter((id) => isRating(src[id])).map((id) => [id, src[id]]));
}

export const noteOf = (w: WheelData | undefined, period: WheelPeriod, needId: string): string => w?.notes?.[period]?.[needId] ?? '';

const without = <T>(rec: Record<string, T>, key: string) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));

/** Оценка потребности за период; undefined снимает оценку. */
export function setRating(w: WheelData, period: WheelPeriod, needId: string, v: number | undefined): WheelData {
  const cur = w.ratings?.[period] ?? {};
  return { ...w, ratings: { ...w.ratings, [period]: v === undefined ? without(cur, needId) : { ...cur, [needId]: v } } };
}

/** Текст листа по потребности и периоду; пустой стирается. */
export function setNote(w: WheelData, period: WheelPeriod, needId: string, text: string): WheelData {
  const cur = w.notes?.[period] ?? {};
  return { ...w, notes: { ...w.notes, [period]: text ? { ...cur, [needId]: text } : without(cur, needId) } };
}

/** «Колесо детства» клиента → период «Детство»: то, что клиент оценил сам, перекрывает оценки терапевта. */
export function withChildhood(w: WheelData, childhood: Record<string, number>): WheelData {
  const valid = Object.fromEntries(NEED_ORDER.filter((id) => isRating(childhood[id])).map((id) => [id, childhood[id]]));
  return { ...w, ratings: { ...w.ratings, child: { ...w.ratings?.child, ...valid } } };
}

export const pctLabel = (v: number | undefined): string => (v === undefined ? '—' : `${v * 10}%`);

/** Средний процент периода, когда оценены все пять; иначе «—» (как индекс дня). */
export function averageLabel(ratings: Record<string, number>): string {
  const vs = NEED_ORDER.map((id) => ratings[id]).filter(isRating);
  return vs.length < NEED_ORDER.length ? '—' : `${Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10)}%`;
}

// ── Геометрия узла: шапка над колесом и само колесо NeedsWheel шириной WHEEL_PX ──
export const WHEEL_PX = 360;
export const HEADER_H = 34;
const SCALE = WHEEL_PX / W;
/** Центр колеса в узле по вертикали: шапка + половина NeedsWheel. */
export const WHEEL_CENTER_Y = HEADER_H + (H * SCALE) / 2;
/** Место под колесо на холсте (шапка, колесо, легенда в две колонки) — для поиска свободного места. */
export const WHEEL_SIZE = { w: WHEEL_PX, h: Math.round(HEADER_H + H * SCALE + 84) };
const NEED_HANDLE = 'need:';

export const needHandle = (needId: string) => `${NEED_HANDLE}${needId}`;
/** id потребности из ручки сектора; у прочих ручек — undefined. */
export const needOfHandle = (h: string | null | undefined): string | undefined =>
  h?.startsWith(NEED_HANDLE) && NEED_ORDER.includes(h.slice(NEED_HANDLE.length) as never) ? h.slice(NEED_HANDLE.length) : undefined;

/** Точка сектора потребности в координатах узла: `f` — доля радиуса (1 — внешний край). */
export function sectorPoint(needId: string, f = 1): { x: number; y: number } {
  const a = wheelAngle(NEED_ORDER.indexOf(needId as never), NEED_ORDER.length);
  return { x: (CX + R * f * Math.cos(a)) * SCALE, y: HEADER_H + (CY + R * f * Math.sin(a)) * SCALE };
}

/** Тип линии к сектору по фигуре на другом конце: от схемы — «✗ блокирует», от здорового режима — «✓ заботится». */
export function wheelEdgeType(otherType: string | undefined): 'blocks' | 'meets' | undefined {
  if (otherType === 'schema') return 'blocks';
  return otherType === 'healthy' ? 'meets' : undefined;
}

/** Конец линии у колеса потребностей — край сектора своей потребности (ручка `need:<id>`); у прочих концов — null. */
export function wheelEnd(node: { type?: string; internals: { positionAbsolute: { x: number; y: number } } }, handle?: string | null) {
  const need = node.type === 'needs' ? needOfHandle(handle) : undefined;
  if (!need) return null;
  const p = sectorPoint(need);
  return { x: node.internals.positionAbsolute.x + p.x, y: node.internals.positionAbsolute.y + p.y };
}
