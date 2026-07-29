// Карточка одного шага из «Моего пути» (выполненная практика, запись
// дневника, тест…): медальон с эмодзи цвета группы по центру, название,
// уточнение (потребность/режим/схема) и дата. Композиция центрированная —
// вместо header() эйбрау рисуется вручную по центру.
import {
  drawEmoji,
  FOOTER_H,
  beginCard,
  footer,
  cardFont,
  tracking,
  withAlpha,
} from '../cardKit';

export interface JourneyItemCardData {
  emoji: string;
  label: string;
  /** Потребность/режим/схема — может отсутствовать */
  sub: string | null;
  day: string;
  hex: string;
}

const EYEBROW_Y = 44;
const MED_R = 48;
const MED_TOP_GAP = 24;
const LABEL_GAP = 40;
const SUB_GAP = 26;
const DAY_GAP = 22;
const BOTTOM_PAD = 30;

/** Высота карточки — чистая формула (зависит только от наличия уточнения). */
export function journeyItemCardHeight(hasSub: boolean): number {
  const medBottom = EYEBROW_Y + MED_TOP_GAP + MED_R * 2;
  const labelY = medBottom + LABEL_GAP;
  const afterLabelY = hasSub ? labelY + SUB_GAP : labelY;
  return afterLabelY + DAY_GAP + BOTTOM_PAD + FOOTER_H;
}

export function drawJourneyItemCard(
  canvas: HTMLCanvasElement,
  data: JourneyItemCardData,
) {
  const hasSub = Boolean(data.sub);
  const H = journeyItemCardHeight(hasSub);
  const c = beginCard(canvas, H, {
    accent: data.hex,
    accent2: 'var(--accent)',
  });
  const { ctx, W, th } = c;

  // Эйбрау по центру — header() тут не подходит (композиция центрированная)
  ctx.font = cardFont(10, 'bold');
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'center';
  tracking(ctx, 1);
  ctx.fillText('МОЙ ПУТЬ', W / 2, EYEBROW_Y);
  tracking(ctx, 0);

  const cx = W / 2;
  const cy = EYEBROW_Y + MED_TOP_GAP + MED_R;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, MED_R);
  grad.addColorStop(0, withAlpha(data.hex, 0.28));
  grad.addColorStop(1, withAlpha(data.hex, 0.04));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, MED_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(data.hex, 0.35);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawEmoji(c, data.emoji, cx, cy + 15, 42, { align: 'center' });

  const labelY = cy + MED_R + LABEL_GAP;
  ctx.font = cardFont(22, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(data.label, cx, labelY);

  let y = labelY;
  if (data.sub) {
    y += SUB_GAP;
    ctx.font = cardFont(13);
    ctx.fillStyle = th.fg(0.55);
    ctx.fillText(data.sub, cx, y);
  }
  y += DAY_GAP;
  ctx.font = cardFont(11.5);
  ctx.fillStyle = th.fg(0.38);
  ctx.fillText(data.day, cx, y);

  ctx.textAlign = 'left';
  footer(c, 'Мой путь');
}
