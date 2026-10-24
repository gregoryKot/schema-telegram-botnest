// Фон share-карточки: диагональный градиент и два мягких свечения цветами
// карточки. Вынесено из frame.ts (правило №10: рамка не растёт вместе с фоном).
import { withAlpha, luminance } from './color';
import type { Card } from './frame';

/**
 * Прозрачность свечения под цвет карточки. Светлые акценты (жёлтый,
 * оранжевый) при той же альфе заливают карточку горчичным — им свечение
 * приглушается, тёмно-синий и фиолетовый остаются в полную силу.
 */
export function glowAlpha(base: number, color: string): number {
  const lum = luminance(color);
  return lum > 0.5 ? base * Math.max(0.5, 1 - (lum - 0.5) * 1.1) : base;
}

/** Рисует фон со свечениями внутри уже наложенного скруглённого клипа. */
export function paintGlow(ctx: CanvasRenderingContext2D, c: Card) {
  const { W, H, th, accent, accent2 } = c;
  const base = ctx.createLinearGradient(0, 0, W * 0.4, H);
  base.addColorStop(0, th.sheetBg);
  base.addColorStop(1, th.bg);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Два мягких свечения цветами карточки: сверху — «рассвет», снизу — отблеск.
  const glowTop = ctx.createRadialGradient(
    W * 0.82,
    -30,
    0,
    W * 0.82,
    -30,
    W * 0.72,
  );
  glowTop.addColorStop(
    0,
    withAlpha(accent, glowAlpha(th.isLight ? 0.3 : 0.4, accent)),
  );
  glowTop.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, Math.min(H, 320));

  const glowBottom = ctx.createRadialGradient(
    -10,
    H + 20,
    0,
    -10,
    H + 20,
    W * 0.66,
  );
  glowBottom.addColorStop(
    0,
    withAlpha(accent2, glowAlpha(th.isLight ? 0.15 : 0.19, accent2)),
  );
  glowBottom.addColorStop(1, withAlpha(accent2, 0));
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, Math.max(0, H - 320), W, Math.min(H, 320));
}
