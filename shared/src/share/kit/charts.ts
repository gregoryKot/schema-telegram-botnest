// Графика карточек: радар потребностей (герой трекера), плитки-показатели,
// полоски прогресса и мини-столбики. Геометрия вынесена в чистые функции —
// их проверяют тесты без canvas.
import { CARD_PAD, cardFont, withAlpha } from './theme';
import { panel, tracking, type Card } from './frame';

export interface RadarPoint {
  emoji: string;
  color: string;
  /** 0..max; null — не отмечено (вершина в центре, значение «—»). */
  value: number | null;
}

/** Точка на окружности: ось i из n, отсчёт от верха по часовой. Чистая. */
export function axisPoint(
  i: number,
  n: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

/**
 * Радиус вершины по значению. У нуля вершина не схлопывается в точку
 * (INNER), иначе полигон вырождается и читается как «данных нет».
 */
export function valueRadius(
  value: number | null,
  max: number,
  r: number,
): number {
  if (value === null) return 0;
  const INNER = 0.08;
  const k = Math.max(0, Math.min(1, value / max));
  return r * (INNER + (1 - INNER) * k);
}

export interface RadarOpts {
  cx: number;
  cy: number;
  r: number;
  max?: number;
  /** Крупное значение в центре — индекс дня/недели. */
  center?: { value: string; caption: string };
}

/** Радар потребностей: сетка, залитый полигон, вершины-точки, эмодзи осей. */
export function drawRadar(c: Card, points: RadarPoint[], o: RadarOpts) {
  const { ctx, th } = c;
  const { cx, cy, r } = o;
  const max = o.max ?? 10;
  const n = points.length;

  // Сетка: кольца по 2 балла и лучи к вершинам
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 5; ring++) {
    const rr = (r * ring) / 5;
    ctx.strokeStyle = th.fg(ring === 5 ? 0.13 : 0.06);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = axisPoint(i, n, rr, cx, cy);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.strokeStyle = th.fg(0.08);
  for (let i = 0; i < n; i++) {
    const p = axisPoint(i, n, r, cx, cy);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  // Полигон оценок
  const verts = points.map((p, i) =>
    axisPoint(i, n, valueRadius(p.value, max, r), cx, cy),
  );
  const fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  fill.addColorStop(0, withAlpha(c.accent, th.isLight ? 0.3 : 0.36));
  fill.addColorStop(1, withAlpha(c.accent2, th.isLight ? 0.14 : 0.16));
  ctx.beginPath();
  verts.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.save();
  ctx.shadowColor = withAlpha(c.accent, 0.55);
  ctx.shadowBlur = 12;
  ctx.strokeStyle = withAlpha(c.accent, 0.95);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Вершины и эмодзи осей
  points.forEach((p, i) => {
    const v = verts[i];
    const dot = th.color(p.color);
    if (p.value === null) {
      ctx.strokeStyle = th.fg(0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = th.bg;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const at = axisPoint(i, n, r + 24, cx, cy);
    ctx.font = '17px serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.emoji, at.x, at.y + 6);
  });
  ctx.textAlign = 'left';

  if (o.center) drawRadarCenter(c, o.center, cx, cy);
}

function drawRadarCenter(
  c: Card,
  center: { value: string; caption: string },
  cx: number,
  cy: number,
) {
  const { ctx, th } = c;
  ctx.fillStyle = withAlpha(th.bg, th.isLight ? 0.9 : 0.86);
  ctx.beginPath();
  ctx.arc(cx, cy, 33, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = th.fg(0.09);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = cardFont(24, 'bold');
  ctx.fillStyle = th.fg(0.96);
  ctx.fillText(center.value, cx, cy + 3);
  ctx.font = cardFont(8.5, 'bold');
  ctx.fillStyle = th.fg(0.42);
  tracking(ctx, 0.6);
  ctx.fillText(center.caption.toUpperCase(), cx, cy + 18);
  tracking(ctx, 0);
  ctx.textAlign = 'left';
}

export interface StatTile {
  label: string;
  value: string;
  /** Приписка справа от значения («/10», «дней»). */
  hint?: string;
  color?: string;
}

/** Ряд плиток-показателей на всю ширину карточки. Возвращает Y под ними. */
export function drawStatTiles(c: Card, tiles: StatTile[], y: number): number {
  const { ctx, th } = c;
  const H = 66;
  const gap = 10;
  const w = (c.W - CARD_PAD * 2 - gap * (tiles.length - 1)) / tiles.length;

  tiles.forEach((t, i) => {
    const x = CARD_PAD + i * (w + gap);
    panel(c, x, y, w, H, 16);
    ctx.textAlign = 'left';
    ctx.font = cardFont(10, 'bold');
    ctx.fillStyle = th.fg(0.4);
    tracking(ctx, 0.6);
    ctx.fillText(t.label.toUpperCase(), x + 14, y + 22);
    tracking(ctx, 0);
    ctx.font = cardFont(24, 'bold');
    ctx.fillStyle = t.color ? th.color(t.color) : th.fg(0.96);
    ctx.fillText(t.value, x + 14, y + 50);
    if (t.hint) {
      const vw = ctx.measureText(t.value).width;
      ctx.font = cardFont(11);
      ctx.fillStyle = th.fg(0.35);
      ctx.fillText(t.hint, x + 14 + vw + 5, y + 49);
    }
  });
  return y + H;
}

/** Полоска прогресса 0..1 с подложкой. */
export function progressBar(
  c: Card,
  x: number,
  y: number,
  w: number,
  pct: number,
  color: string,
  h = 8,
) {
  const { ctx, th } = c;
  ctx.fillStyle = th.fg(0.08);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  const filled = Math.max(0, Math.min(1, pct));
  if (filled <= 0) return;
  const fw = Math.max(h, w * filled);
  const grad = ctx.createLinearGradient(x, 0, x + fw, 0);
  grad.addColorStop(0, withAlpha(color, 0.55));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, fw, h, h / 2);
  ctx.fill();
}
