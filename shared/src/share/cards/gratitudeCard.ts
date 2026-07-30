// Карточка записи благодарности. Свободный текст пользователя попадает на
// картинку только по явному действию на конкретной записи, с превью перед
// отправкой (ShareCardSheet). Тот же принцип — у journeyResultCard.
import {
  drawEmoji,
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  panel,
  panelStack,
  measureWrap,
  clampLines,
  cardFont,
} from '../cardKit';

const ITEM_PAD = 14;
const ITEM_GAP = 10;
const LINE_H = 21;
const MAX_ITEMS = 3;
const MAX_LINES = 3;
const EMOJI_W = 26;

export function drawGratitudeCard(
  canvas: HTMLCanvasElement,
  items: string[],
  dateLabel: string,
) {
  const maxW = CARD_W - CARD_PAD * 2;
  const textMaxW = maxW - ITEM_PAD * 2 - EMOJI_W;
  const shown = items.slice(0, MAX_ITEMS);
  const wrapped = shown.map((t) =>
    clampLines(measureWrap(canvas, t, textMaxW, 14), MAX_LINES),
  );
  const { heights: panelHeights, total: bodyH } = panelStack(
    wrapped.map((lines) => lines.length),
    { lineH: LINE_H, pad: ITEM_PAD, gap: ITEM_GAP },
  );

  const H = headerHeight(1, true) + bodyH + 20 + FOOTER_H;

  const c = beginCard(canvas, H, {
    accent: 'var(--accent-green)',
    accent2: 'var(--accent-blue)',
  });
  const { ctx, th } = c;

  const contentY = header(c, {
    eyebrow: 'Дневник благодарности',
    title: '🌱 Благодарность',
    subtitle: dateLabel,
  });

  let y = contentY;
  wrapped.forEach((lines, i) => {
    const h = panelHeights[i];
    panel(c, CARD_PAD, y, maxW, h, 16);

    drawEmoji(c, '🌱', CARD_PAD + ITEM_PAD, y + ITEM_PAD + 11, 14);

    let ty = y + ITEM_PAD + 11;
    for (const line of lines) {
      ctx.font = cardFont(14);
      ctx.fillStyle = th.fg(0.85);
      ctx.fillText(line, CARD_PAD + ITEM_PAD + EMOJI_W, ty);
      ty += LINE_H;
    }

    y += h + ITEM_GAP;
  });

  footer(c, 'Дневник благодарности');
}
