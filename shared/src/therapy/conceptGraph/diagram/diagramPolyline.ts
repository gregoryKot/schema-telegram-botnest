// Ломаные линии со скруглёнными углами в виде цепочки кубических кривых (тот
// же формат, что у остальных рёбер) и выбор места для значка на линии.
import { bezierAt, type Rect } from './diagramCurves';
import type { Pt } from './diagramTypes';

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Прямой отрезок как кубическая кривая. */
function segment(a: Pt, b: Pt): Pt[] {
  return [lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b];
}

/** Убирает подряд идущие совпадающие точки. */
function dedupe(points: Pt[]): Pt[] {
  return points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 0.01);
}

/**
 * Ломаная через точки с углами, скруглёнными радиусом до r (меньше, если
 * соседний отрезок короче). Точки на одной прямой остаются прямым отрезком.
 */
export function rounded(corners: Pt[], r = 10): Pt[] {
  const pts = dedupe(corners);
  if (pts.length < 2) return pts.length ? [pts[0], pts[0], pts[0], pts[0]] : [];
  const out: Pt[] = [pts[0]];
  let cur = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const c = pts[i];
    const b = pts[i + 1];
    const rr = Math.min(r, dist(a, c) / 2, dist(c, b) / 2);
    const enter = lerp(c, a, rr / dist(a, c));
    const leave = lerp(c, b, rr / dist(c, b));
    out.push(...segment(cur, enter));
    out.push(lerp(enter, c, 0.55), lerp(leave, c, 0.55), leave);
    cur = leave;
  }
  out.push(...segment(cur, pts[pts.length - 1]));
  return out;
}

/** Точки вдоль цепочки кривых (для длины и поиска места под значок). */
export function sampleChain(points: Pt[], perSegment = 12): Pt[] {
  const out: Pt[] = [points[0]];
  for (let i = 0; i + 3 < points.length; i += 3) {
    const seg = points.slice(i, i + 4);
    for (let k = 1; k <= perSegment; k++)
      out.push(bezierAt(seg, k / perSegment));
  }
  return out;
}

const inside = (p: Pt, r: Rect, pad: number) =>
  p.x > r.x - pad &&
  p.x < r.x + r.w + pad &&
  p.y > r.y - pad &&
  p.y < r.y + r.h + pad;

/**
 * Место под значок ✗ / ✓: ближе к середине линии, но не под фигурой, не
 * вплотную к концам (значок не должен закрывать стрелку) и не на другом
 * значке: `taken` — уже поставленные значки.
 */
export function badgePoint(
  points: Pt[],
  obstacles: Rect[],
  taken: Pt[] = [],
  radius = 12,
): Pt {
  const pts = sampleChain(points);
  const lens = pts.map((_, i) =>
    pts.slice(1, i + 1).reduce((acc, p, k) => acc + dist(pts[k], p), 0),
  );
  const total = lens[lens.length - 1] || 1;
  const ok = pts
    .map((p, i) => ({
      p,
      f: lens[i] / total,
      d: lens[i],
      rest: total - lens[i],
    }))
    .filter(
      (c) =>
        c.d > radius + 6 &&
        c.rest > radius + 12 &&
        !obstacles.some((o) => inside(c.p, o, radius)) &&
        !taken.some((t) => dist(t, c.p) < 2.4 * radius),
    );
  if (ok.length === 0) return pts[Math.floor(pts.length / 2)];
  return ok.reduce((best, c) =>
    Math.abs(c.f - 0.5) < Math.abs(best.f - 0.5) ? c : best,
  ).p;
}
