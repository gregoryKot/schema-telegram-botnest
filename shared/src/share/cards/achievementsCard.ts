// Сводная карточка достижений: сетка эмодзи (полученные — ярко, остальные —
// приглушённо) + полоска прогресса «N из M».
import {
  drawEmoji,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  panel,
  footer,
  cardFont,
  progressBar,
} from '../cardKit';

export interface AchievementsCardItem {
  emoji: string;
  earned: boolean;
}

const PER_ROW = 5;
const CELL = 56;
const GAP = 10;
const GRID_W = PER_ROW * CELL + (PER_ROW - 1) * GAP;

export function drawAchievementsCard(
  canvas: HTMLCanvasElement,
  items: AchievementsCardItem[],
) {
  const rows = Math.max(1, Math.ceil(items.length / PER_ROW));
  const gridH = rows * CELL + (rows - 1) * GAP;
  const earned = items.filter((i) => i.earned).length;
  const total = items.length;

  const H = headerHeight(1, true) + gridH + 24 + 8 + 24 + 16 + FOOTER_H;
  const c = beginCard(canvas, H, {
    accent: 'var(--accent-yellow)',
    accent2: 'var(--accent-orange)',
  });
  const { ctx, th } = c;

  const contentY = header(c, {
    eyebrow: 'Достижения',
    title: 'Мои достижения',
    subtitle: `собрано ${earned} из ${total}`,
  });

  const gx = (c.W - GRID_W) / 2;
  items.forEach((item, i) => {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const x = gx + col * (CELL + GAP);
    const y = contentY + row * (CELL + GAP);
    if (item.earned) {
      panel(c, x, y, CELL, CELL, 14);
    } else {
      ctx.fillStyle = th.fg(0.03);
      ctx.beginPath();
      ctx.roundRect(x, y, CELL, CELL, 14);
      ctx.fill();
    }
    drawEmoji(c, item.emoji, x + CELL / 2, y + CELL / 2 + 10, 28, {
      align: 'center',
      alpha: item.earned ? 1 : 0.22,
    });
  });
  ctx.textAlign = 'left';

  const barY = contentY + gridH + 24;
  const barW = c.W - CARD_PAD * 2;
  progressBar(
    c,
    CARD_PAD,
    barY,
    barW,
    total > 0 ? earned / total : 0,
    c.accent,
  );

  const textY = barY + 24;
  ctx.font = cardFont(13, 'bold');
  ctx.fillStyle = th.fg(0.9);
  ctx.textAlign = 'left';
  ctx.fillText(`${earned} из ${total}`, CARD_PAD, textY);

  ctx.font = cardFont(13);
  ctx.fillStyle = th.fg(0.45);
  ctx.textAlign = 'right';
  ctx.fillText(
    total > 0 ? `${Math.round((earned / total) * 100)}%` : '0%',
    c.W - CARD_PAD,
    textY,
  );
  ctx.textAlign = 'left';

  footer(c, 'Достижения');
}
