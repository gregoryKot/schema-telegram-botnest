// Карточка записи благодарности. Свободный текст пользователя попадает на
// картинку только по явному действию на конкретной записи, с превью перед
// отправкой (ShareCardSheet). Тот же принцип — у journeyResultCard.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  header,
  footer,
  measureWrap,
  clampLines,
  cardFont,
} from '../cardKit';

export function drawGratitudeCard(
  canvas: HTMLCanvasElement,
  items: string[],
  dateLabel: string,
) {
  const maxW = CARD_W - CARD_PAD * 2 - 26;
  const shown = items.slice(0, 3);
  const wrapped = shown.map((t) =>
    clampLines(measureWrap(canvas, t, maxW, 14), 3),
  );
  const LINE_H = 22;
  const ITEM_GAP = 14;
  const bodyH = wrapped.reduce(
    (s, lines) => s + lines.length * LINE_H + ITEM_GAP,
    0,
  );
  const H = 120 + bodyH + 12 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, th } = c;

  accentBar(c, '#06d6a0', '#4ade80');
  header(c, '🌱 Благодарность', dateLabel);

  let y = 124;
  for (const lines of wrapped) {
    ctx.font = '14px serif';
    ctx.textAlign = 'left';
    ctx.fillText('🌱', CARD_PAD, y);
    for (const line of lines) {
      ctx.font = cardFont(14);
      ctx.fillStyle = th.fg(0.85);
      ctx.fillText(line, CARD_PAD + 26, y);
      y += LINE_H;
    }
    y += ITEM_GAP;
  }

  footer(c, 'Дневник благодарности');
}
