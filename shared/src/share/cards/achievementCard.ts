// Карточка достижения (b23b): лист оттенка значка, его знак крупно по центру — тот же значок,
// что в профиле (ACHIEVEMENT_LOOK → achievementCardLook), название Literata и описание.
// Медальона с градиентом и галочки нет: значок говорит знаком, как на экране.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  INK,
  SERIF,
  achievementCardLook,
  beginCard,
  cardFont,
  drawDrawing,
  drawingHeight,
  footer,
  lookDrawing,
  measureClamp,
  serifFont,
  tracking,
} from '../cardKit';
import type { SignDrawing } from '../kit/signs';

export interface AchievementMeta {
  title: string;
  desc: string;
}

const EYEBROW_Y = 54;
const ART_TOP = 82;
const ART_BOX = 150;
const ART_W = 180;
const TITLE_LH = 36;
const DESC_LH = 21;

/** Знак значка, вписанный в квадрат ART_BOX: ширина и высота. Чистая. */
export function achievementArtSize(d: SignDrawing | null): {
  w: number;
  h: number;
} {
  if (!d) return { w: 0, h: 0 };
  const h = drawingHeight(d, ART_W);
  const w = h > ART_BOX ? (ART_W * ART_BOX) / h : ART_W;
  return { w, h: drawingHeight(d, w) };
}

export function drawAchievementCard(
  canvas: HTMLCanvasElement,
  m: AchievementMeta & { id?: string },
) {
  const look = achievementCardLook(m.id);
  const maxW = CARD_W - CARD_PAD * 2;
  const title = measureClamp(canvas, m.title, maxW, 30, 2, undefined, SERIF);
  const desc = measureClamp(canvas, m.desc, maxW, 14, 3);
  const titleY = ART_TOP + (look ? ART_BOX : 0) + 52;
  const descY = titleY + (title.length - 1) * TITLE_LH + 32;
  const H = descY + (desc.length - 1) * DESC_LH + 34 + FOOTER_H;

  const c = beginCard(canvas, H, { hue: look?.hue ?? 45 });
  const { ctx } = c;
  const cx = c.W / 2;

  ctx.textAlign = 'center';
  ctx.font = cardFont(10.5, 'bold');
  ctx.fillStyle = c.accent;
  tracking(ctx, 1.1);
  ctx.fillText('ДОСТИЖЕНИЕ', cx, EYEBROW_Y);
  tracking(ctx, 0);

  const drawing = lookDrawing(look);
  if (drawing) {
    const art = achievementArtSize(drawing);
    drawDrawing(
      ctx,
      drawing,
      cx - art.w / 2,
      ART_TOP + (ART_BOX - art.h) / 2,
      art.w,
    );
  }

  ctx.textAlign = 'center';
  ctx.font = serifFont(30);
  ctx.fillStyle = INK.text;
  title.forEach((line, i) => ctx.fillText(line, cx, titleY + i * TITLE_LH));

  ctx.font = cardFont(14);
  ctx.fillStyle = INK.sub;
  desc.forEach((line, i) => ctx.fillText(line, cx, descY + i * DESC_LH));

  ctx.textAlign = 'left';
  footer(c, 'Достижение');
}
