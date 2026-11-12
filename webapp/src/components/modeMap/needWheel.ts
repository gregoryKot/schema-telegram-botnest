import type { ModeMapNode } from '../../api';
import { NEED_ORDER, getNeedData } from '../../../../shared/src/needs/needData';
import { CX, CY, H, R, W, wheelAngle } from '../../../../shared/src/components/needsWheelGeometry';
import { NEED_PERIOD_LABEL, type NeedPeriod } from '../../../../shared/src/therapy/conceptGraph/needLinks';

// Колесо потребностей на холсте (владелец 2026-11-10, лист Farrell & Shaw «Как эти
// потребности удовлетворялись в детстве, в подростковом возрасте и сейчас»): у каждой
// из пяти потребностей — оценка 0–10 и текст по трём периодам. Шкала та же, что у
// упражнения «Колесо детства» и колеса дня (ChildhoodRating, NeedsWheel), на холсте
// она читается процентами. Оценки и тексты — в концептуализации клиента (wheelData.ts);
// здесь вид узла: период, подписи, геометрия секторов и линий.

export type WheelPeriod = NeedPeriod;
/** Что узел колеса хранит в карте: только вид. Оценки и тексты — в концептуализации (wheelData.ts). */
export type WheelView = NonNullable<ModeMapNode['data']['wheel']>;

export const PERIODS: { id: WheelPeriod; label: string; center: string; note: string }[] = [
  { id: 'child', label: NEED_PERIOD_LABEL.child, center: 'детство', note: 'Детский опыт, связанный с потребностью' },
  { id: 'teen', label: NEED_PERIOD_LABEL.teen, center: '11–17', note: 'Подростковый опыт, связанный с потребностью' },
  { id: 'now', label: NEED_PERIOD_LABEL.now, center: 'сейчас', note: 'Как сейчас старается её удовлетворить' },
];

const NAMES = getNeedData('ty'); // названия потребностей одинаковы в обеих формах обращения
/** Потребности колеса в порядке секторов, в форме общего NeedsWheel. */
export const WHEEL_NEEDS = NEED_ORDER.map((id) => ({ id, emoji: '', title: NAMES[id].name, chartLabel: NAMES[id].name }));

/** Клик по сектору на холсте: панель колеса открывает эту потребность (WheelFields слушает событие). */
export const WHEEL_NEED_EVENT = 'modemap-wheel-need';

/** Узел «needs» — колесо, а не старый круг с таблетками внутри. */
export const isWheel = (d: { wheel?: unknown } | undefined): boolean => !!d?.wheel;

export const wheelPeriod = (w: WheelView | undefined): WheelPeriod => w?.period ?? 'now';

/** Средний процент периода, когда оценены все пять; иначе «—» (как индекс дня). */
export function averageLabel(ratings: Record<string, number>): string {
  const vs = NEED_ORDER.map((id) => ratings[id]).filter((v): v is number => typeof v === 'number');
  return vs.length < NEED_ORDER.length ? '—' : `${Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10)}%`;
}

// ── Геометрия узла: шапка, под ней колесо NeedsWheel шириной WHEEL_PX с полями по бокам под подписи секторов ──
const WHEEL_PX = 360;
const PAD_X = 62;
export const HEADER_H = 34;
/** Ширина узла колеса на холсте. */
export const WHEEL_NODE_W = WHEEL_PX + 2 * PAD_X;
const SCALE = WHEEL_PX / W;
/** Центр колеса в узле по вертикали: шапка + половина NeedsWheel. */
export const WHEEL_CENTER_Y = HEADER_H + (H * SCALE) / 2;
/** Место под колесо на холсте — для поиска свободного места. */
export const WHEEL_SIZE = { w: WHEEL_NODE_W, h: Math.round(HEADER_H + H * SCALE + 30) };
const NEED_HANDLE = 'need:';

export const needHandle = (needId: string) => `${NEED_HANDLE}${needId}`;
/** id потребности из ручки сектора; у прочих ручек — undefined. */
export const needOfHandle = (h: string | null | undefined): string | undefined =>
  h?.startsWith(NEED_HANDLE) && NEED_ORDER.includes(h.slice(NEED_HANDLE.length) as never) ? h.slice(NEED_HANDLE.length) : undefined;

/** Точка сектора потребности в координатах узла: `f` — доля радиуса (1 — внешний край). */
export function sectorPoint(needId: string, f = 1): { x: number; y: number } {
  const a = wheelAngle(NEED_ORDER.indexOf(needId as never), NEED_ORDER.length);
  return { x: PAD_X + (CX + R * f * Math.cos(a)) * SCALE, y: HEADER_H + (CY + R * f * Math.sin(a)) * SCALE };
}

/** Где стоит подпись сектора: над колесом по центру (верхний сектор), справа или слева от него. */
export function labelSide(needId: string): 'top' | 'right' | 'left' {
  const cos = Math.cos(wheelAngle(NEED_ORDER.indexOf(needId as never), NEED_ORDER.length));
  return Math.abs(cos) < 0.2 ? 'top' : cos > 0 ? 'right' : 'left';
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
