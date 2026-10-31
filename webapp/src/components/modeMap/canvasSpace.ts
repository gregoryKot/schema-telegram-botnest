// Свободное место на холсте карты режимов: куда положить новую фигуру и
// какие отступы дать «Показать всё», чтобы фигуры не прятались под панелями
// (тулбар сверху, подсказки справа, легенда снизу). Чистые функции — сам
// холст меряет DOM в useCanvasSpace и передаёт сюда прямоугольники.

export interface Rect { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }

/** Оценка размера новой фигуры до её отрисовки (режим, триггер, схема). */
export const NEW_NODE_SIZE: Size = { w: 200, h: 130 };
/** Зазор между фигурами и до краёв видимой области. */
export const NODE_GAP = 24;

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap
    && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/**
 * Первое свободное место для фигуры размера `size` в видимой области `view`:
 * построчно, слева направо, шагом в полфигуры — не ближе `gap` к занятым
 * прямоугольникам (фигуры и панели поверх холста). Видимая область занята
 * целиком — справа от всех фигур на уровне верха области: фигура не ложится
 * на другую, а холст потом подстраивается «Показать всё».
 */
export function findFreeSpot(view: Rect, taken: Rect[], size: Size = NEW_NODE_SIZE, gap = NODE_GAP): { x: number; y: number } {
  const stepX = (size.w + gap) / 2;
  const stepY = (size.h + gap) / 2;
  for (let y = view.y + gap; y + size.h <= view.y + view.h - gap; y += stepY) {
    for (let x = view.x + gap; x + size.w <= view.x + view.w - gap; x += stepX) {
      const r = { x, y, ...size };
      if (!taken.some(t => overlaps(r, t, gap))) return { x: Math.round(x), y: Math.round(y) };
    }
  }
  const right = taken.length ? Math.max(...taken.map(t => t.x + t.w)) : view.x;
  return { x: Math.round(right + gap * 2), y: Math.round(view.y + gap) };
}

/** Несколько фигур подряд: каждая следующая учитывает уже положенные. */
export function findFreeSpots(view: Rect, taken: Rect[], count: number, size: Size = NEW_NODE_SIZE): { x: number; y: number }[] {
  const busy = [...taken];
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const p = findFreeSpot(view, busy, size);
    out.push(p);
    busy.push({ ...p, ...size });
  }
  return out;
}

/** Фигура целиком внутри области. */
export function insideView(view: Rect, p: { x: number; y: number }, size: Size = NEW_NODE_SIZE): boolean {
  return p.x >= view.x && p.y >= view.y && p.x + size.w <= view.x + view.w && p.y + size.h <= view.y + view.h;
}

export interface Insets { top: number; right: number; bottom: number; left: number }

/**
 * Отступы «Показать всё» (px экрана) с учётом панелей поверх холста. Панель
 * относится к той стороне, у которой она теснит меньше площади: широкий низкий
 * тулбар — к верху, высокая колонка подсказок — к правому краю. Отступ
 * стороны = насколько панель заходит внутрь от края + `base`.
 */
export function fitInsets(pane: Size, panels: Rect[], base = NODE_GAP): Insets {
  const ins: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const p of panels) {
    if (p.w <= 0 || p.h <= 0) continue;
    const side = p.h / pane.h > p.w / pane.w;
    if (side) {
      const fromLeft = p.x + p.w, fromRight = pane.w - p.x;
      if (fromLeft <= fromRight) ins.left = Math.max(ins.left, fromLeft);
      else ins.right = Math.max(ins.right, fromRight);
    } else {
      const fromTop = p.y + p.h, fromBottom = pane.h - p.y;
      if (fromTop <= fromBottom) ins.top = Math.max(ins.top, fromTop);
      else ins.bottom = Math.max(ins.bottom, fromBottom);
    }
  }
  // Панели не отнимают больше половины холста: иначе фигурам не остаётся места.
  const cap = (v: number, total: number) => Math.round(Math.min(v, total / 2) + base);
  return { top: cap(ins.top, pane.h), right: cap(ins.right, pane.w), bottom: cap(ins.bottom, pane.h), left: cap(ins.left, pane.w) };
}
