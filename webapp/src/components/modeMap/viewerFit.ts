// Начальный вид карты у клиента (ModeMapViewer). На телефоне вся карта при «Показать всё» —
// подписи по 4–5px: открываем читаемый фрагмент с центром на главной фигуре, остальное — пальцем.

/** Зум, при котором обычная подпись фигуры (13,5px, nodeStyle.ts) на экране не мельче 14px. */
export const READABLE_ZOOM = 1.05;
/** Уже этой ширины холста карта открывается читаемым фрагментом, если целиком читаемой не помещается. */
export const PHONE_PANE = 640;
/** Доля холста на поля при «Показать всё». */
export const FIT_PADDING = 0.12;

interface Size { w: number; h: number }
interface ViewNode { id: string; type?: string }
interface ViewEdge { source: string; target: string }

/** Зум, при котором карта размера `bounds` целиком входит в холст `pane` с полями. */
export function fitZoom(pane: Size, bounds: Size, padding = FIT_PADDING): number {
  if (bounds.w <= 0 || bounds.h <= 0) return 1;
  const k = 1 - 2 * padding;
  return Math.min((pane.w * k) / bounds.w, (pane.h * k) / bounds.h);
}

/** 'all' — показать карту целиком; 'focus' — читаемый фрагмент вокруг главной фигуры (только узкий холст). */
export function viewerFitPlan(pane: Size, bounds: Size): 'all' | 'focus' {
  return pane.w < PHONE_PANE && fitZoom(pane, bounds) < READABLE_ZOOM ? 'focus' : 'all';
}

/** Главная фигура карты: колесо или круг потребностей; иначе — та, у которой больше всего связей (при равенстве — первая). */
export function mainNodeId(nodes: readonly ViewNode[], edges: readonly ViewEdge[]): string | undefined {
  const hub = nodes.find((n) => n.type === 'needs');
  if (hub) return hub.id;
  const degree = new Map<string, number>();
  for (const e of edges) for (const id of [e.source, e.target]) degree.set(id, (degree.get(id) ?? 0) + 1);
  let best: string | undefined;
  for (const n of nodes) if (best === undefined || (degree.get(n.id) ?? 0) > (degree.get(best) ?? 0)) best = n.id;
  return best;
}
