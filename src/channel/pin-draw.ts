import type { SKRSContext2D } from '@napi-rs/canvas';
import type { PinCorner, PinStyle } from './pin-style';
import { FONT, H, PAD, W } from './pin-image';

/**
 * Рисование фона и декора пина. Вынесено из `pin-image`, чтобы рендер читался
 * как сценарий («фон, рамка, текст, подпись»), а не тонул в координатах.
 */

/** Точка угла с отступом — общая для пятна света и декора. */
function cornerPoint(corner: PinCorner, inset: number): [number, number] {
  const x = corner === 'tl' || corner === 'bl' ? inset : W - inset;
  const y = corner === 'tl' || corner === 'tr' ? inset : H - inset;
  return [x, y];
}

/** Фон: заливка плюс градиент выбранной формы. */
export function drawBackdrop(ctx: SKRSContext2D, style: PinStyle): void {
  const { bg, bgTo } = style.palette;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (style.backdrop === 'glow') {
    // Мягкое пятно света в углу — пин перестаёт быть плоским прямоугольником.
    const [cx, cy] = cornerPoint(style.corner, 260);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.95);
    glow.addColorStop(0, bgTo);
    glow.addColorStop(1, bg);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  const linear =
    style.backdrop === 'vertical'
      ? ctx.createLinearGradient(0, 0, 0, H)
      : ctx.createLinearGradient(0, 0, W, H);
  linear.addColorStop(0, bgTo);
  linear.addColorStop(1, bg);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = linear;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

/** Тонкая рамка-инсет: раскладка `frame` строится вокруг неё. */
export function drawFrame(ctx: SKRSContext2D, style: PinStyle): void {
  const inset = PAD - 26;
  ctx.strokeStyle = `rgba(${style.palette.fg},${style.palette.dark ? 0.22 : 0.3})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
}

/**
 * Знак у цитаты. Он же задаёт настроение пина, поэтому вариантов несколько:
 * кавычка, точка акцентом, черта — и «ничего», когда текст должен звучать без
 * украшений.
 */
export function drawDecor(
  ctx: SKRSContext2D,
  style: PinStyle,
  pad: number,
  textTop: number,
): void {
  const { palette, decor } = style;
  const soft = palette.dark ? 0.16 : 0.2;

  if (decor === 'quote') {
    ctx.fillStyle = `rgba(${palette.fg},${soft})`;
    ctx.font = `bold 220px ${FONT}`;
    ctx.fillText('«', pad - 10, textTop - 100);
    return;
  }
  if (decor === 'dot') {
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(pad + 13, textTop - 96, 13, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (decor === 'rule') {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(pad, textTop - 100, 96, 5);
  }
}
