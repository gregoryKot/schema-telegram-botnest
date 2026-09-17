// Карточка достижения: кольцо-медальон, титул, описание — по центру.
// Эмодзи внутри медальона больше нет: на экране профиля их убрали, и
// картинка не должна заводить второй, «только для шаринга», словарь значков.
// Пустое кольцо работает как рамка вокруг названия — оно и есть медальон.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  footer,
  drawWrapped,
  measureWrap,
  cardFont,
  withAlpha,
  tracking,
} from '../cardKit';

export interface AchievementMeta {
  title: string;
  desc: string;
}

const MED_R = 48;
// Отступы сверху вниз: эйбрау → медальон → титул → описание
const EYEBROW_Y = 30;
const GAP_TO_MEDALLION = 24;
const GAP_TO_TITLE = 30;
const GAP_TO_DESC = 16;
const GAP_TO_FOOTER = 16;

export function drawAchievementCard(
  canvas: HTMLCanvasElement,
  m: AchievementMeta,
) {
  const maxW = CARD_W - CARD_PAD * 2;
  const descLines = Math.min(measureWrap(canvas, m.desc, maxW, 13).length, 3);

  const medallionBottom = EYEBROW_Y + GAP_TO_MEDALLION + MED_R * 2;
  const titleY = medallionBottom + GAP_TO_TITLE;
  const descStartY = titleY + GAP_TO_DESC;
  const H = descStartY + descLines * 20 + GAP_TO_FOOTER + FOOTER_H;

  const c = beginCard(canvas, H, {
    accent: 'var(--accent-yellow)',
    accent2: 'var(--accent-orange)',
  });
  const { ctx, th } = c;
  const cx = c.W / 2;
  const cy = EYEBROW_Y + GAP_TO_MEDALLION + MED_R;

  ctx.font = cardFont(10, 'bold');
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'center';
  tracking(ctx, 1);
  ctx.fillText('ДОСТИЖЕНИЕ', cx, EYEBROW_Y);
  tracking(ctx, 0);

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, MED_R);
  glow.addColorStop(0, withAlpha(c.accent, 0.3));
  glow.addColorStop(1, withAlpha(c.accent, 0.04));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, MED_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(c.accent, 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Внутри медальона — типографическая галочка: достижение получено.
  // Знак один на все достижения, поэтому не требует расшифровки.
  ctx.font = cardFont(44, 'bold');
  ctx.fillStyle = c.accent;
  ctx.fillText('✓', cx, cy + 16);

  ctx.font = cardFont(24, 'bold');
  ctx.fillStyle = th.fg(0.96);
  ctx.fillText(m.title, cx, titleY);

  drawWrapped(c, m.desc, cx, descStartY, maxW, {
    size: 13,
    color: th.fg(0.55),
    lineH: 20,
    maxLines: 3,
    align: 'center',
  });

  footer(c, 'Достижение');
}
