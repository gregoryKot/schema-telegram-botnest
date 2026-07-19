// Сводная карточка достижений: сетка эмодзи (полученные — ярко, остальные —
// приглушённо) + «N из M».
import {
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  header,
  divider,
  footer,
  cardFont,
} from '../cardKit';

export interface AchievementsCardItem {
  emoji: string;
  earned: boolean;
}

export function drawAchievementsCard(
  canvas: HTMLCanvasElement,
  items: AchievementsCardItem[],
) {
  const PER_ROW = 5;
  const CELL = 56;
  const GAP = 10;
  const rows = Math.max(1, Math.ceil(items.length / PER_ROW));
  const GRID_H = rows * CELL + (rows - 1) * GAP;
  const H = 120 + GRID_H + 24 + 78 + FOOTER_H - 36;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;

  const earned = items.filter((i) => i.earned).length;

  accentBar(c, '#facc15', '#ff9a3c');
  header(c, 'Достижения');

  const GRID_W = PER_ROW * CELL + (PER_ROW - 1) * GAP;
  const gx = (W - GRID_W) / 2;
  const gy = 116;
  items.forEach((item, i) => {
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const x = gx + col * (CELL + GAP);
    const y = gy + row * (CELL + GAP);
    ctx.fillStyle = item.earned ? th.fg(0.08) : th.fg(0.03);
    ctx.beginPath();
    ctx.roundRect(x, y, CELL, CELL, 14);
    ctx.fill();
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = item.earned ? 1 : 0.22;
    ctx.fillText(item.emoji, x + CELL / 2, y + CELL / 2 + 10);
    ctx.globalAlpha = 1;
  });

  const statsDivY = gy + GRID_H + 22;
  divider(c, statsDivY);
  const statsY = statsDivY + 22;

  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.35);
  ctx.textAlign = 'left';
  ctx.fillText('Получено', CARD_PAD, statsY);
  ctx.font = cardFont(26, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(`${earned} из ${items.length}`, CARD_PAD, statsY + 30);
  ctx.textAlign = 'left';

  footer(c, 'Достижения');
}
