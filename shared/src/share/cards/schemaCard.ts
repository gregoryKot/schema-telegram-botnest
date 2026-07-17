// Карточка схемы: домен, название, описание, типичное убеждение.
// Приватных данных нет — только справочный контент из данных фронтенда.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  divider,
  footer,
  measureWrap,
  clampLines,
  cardFont,
  resolveCardTheme,
} from '../cardKit';

export interface SchemaCardData {
  domain: string;
  /** CSS-переменная или hex — резолвится китом */
  domainColor: string;
  name: string;
  desc: string;
  belief?: string;
}

export function drawSchemaCard(canvas: HTMLCanvasElement, d: SchemaCardData) {
  const maxW = CARD_W - CARD_PAD * 2;
  const nameLines = clampLines(
    measureWrap(canvas, d.name, maxW, 20, 'bold'),
    2,
  );
  const descLines = clampLines(measureWrap(canvas, d.desc, maxW, 13), 6);
  const beliefText = d.belief ? `«${d.belief}»` : '';
  const beliefLines = beliefText
    ? clampLines(measureWrap(canvas, beliefText, maxW - 16, 13), 3)
    : [];

  const nameH = nameLines.length * 26;
  const descH = descLines.length * 21;
  const beliefH = beliefLines.length ? beliefLines.length * 20 + 26 : 0;
  const H = 78 + nameH + 14 + descH + beliefH + 20 + FOOTER_H;

  const c = beginCard(canvas, H);
  const { ctx, th } = c;
  const color = resolveCardTheme().color(d.domainColor);

  accentBar(c, color, color);

  ctx.font = cardFont(10, 'bold');
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(d.domain.toUpperCase(), CARD_PAD, 54);

  let y = 82;
  for (const line of nameLines) {
    ctx.font = cardFont(20, 'bold');
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(line, CARD_PAD, y);
    y += 26;
  }

  divider(c, y - 12);
  y += 10;

  for (const line of descLines) {
    ctx.font = cardFont(13);
    ctx.fillStyle = th.fg(0.6);
    ctx.fillText(line, CARD_PAD, y);
    y += 21;
  }

  if (beliefLines.length) {
    y += 16;
    ctx.fillStyle = color;
    ctx.fillRect(CARD_PAD, y - 13, 2, beliefLines.length * 20 + 4);
    for (const line of beliefLines) {
      ctx.font = `italic ${cardFont(13)}`;
      ctx.fillStyle = th.fg(0.5);
      ctx.fillText(line, CARD_PAD + 16, y);
      y += 20;
    }
  }

  footer(c, 'Схема-терапия');
}
