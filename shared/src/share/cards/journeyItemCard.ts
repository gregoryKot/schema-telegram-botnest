// Карточка одного шага из «Моего пути» (выполненная практика, запись
// дневника, тест…): крупное эмодзи в тонированной плашке цвета группы,
// название, уточнение (потребность/режим/схема) и дата.
import {
  FOOTER_H,
  beginCard,
  accentBar,
  header,
  footer,
  cardFont,
} from '../cardKit';

export interface JourneyItemCardData {
  emoji: string;
  label: string;
  /** Потребность/режим/схема — может отсутствовать */
  sub: string | null;
  day: string;
  hex: string;
}

export function drawJourneyItemCard(
  canvas: HTMLCanvasElement,
  data: JourneyItemCardData,
) {
  const H = 112 + 208 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;

  accentBar(c, data.hex);
  const contentY = header(c, 'Мой путь', 'ещё один шаг заботы о себе');

  // Тонированная плашка с эмодзи
  const TILE = 88;
  const tileX = (W - TILE) / 2;
  const tileY = contentY + 18;
  ctx.fillStyle = `${data.hex}22`;
  ctx.beginPath();
  ctx.roundRect(tileX, tileY, TILE, TILE, 24);
  ctx.fill();
  ctx.font = '44px serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.emoji, W / 2, tileY + TILE / 2 + 16);

  // Название шага
  ctx.font = cardFont(20, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(data.label, W / 2, tileY + TILE + 40);

  // Уточнение и дата
  ctx.font = cardFont(13);
  ctx.fillStyle = th.fg(0.5);
  const subY = tileY + TILE + 64;
  if (data.sub) ctx.fillText(data.sub, W / 2, subY);
  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.35);
  ctx.fillText(data.day, W / 2, data.sub ? subY + 22 : subY);
  ctx.textAlign = 'left';

  footer(c, 'Мой путь');
}
