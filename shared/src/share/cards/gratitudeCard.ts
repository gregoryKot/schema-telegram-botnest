// Карточка записи благодарности. Свободный текст пользователя попадает на
// картинку только по явному действию на конкретной записи, с превью перед
// отправкой (ShareCardSheet). Тот же принцип — у journeyResultCard.
// Лист бирюзы благодарности со знаком Pebbles (ENTITY_LOOK gratitude); пункт —
// светлая плашка с камешком своего цвета (мотив Pebbles) вместо эмодзи.
import {
  CARD_LOOK,
  PAPER_INK,
  INK,
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  panel,
  panelStack,
  measureClamp,
  cardFont,
} from '../cardKit';

const ITEM_PAD = 14;
const ITEM_GAP = 10;
const LINE_H = 21;
const MAX_ITEMS = 3;
const MAX_LINES = 3;
const MARK_W = 26;
/** Камешки мотива Pebbles по порядку: первый пункт — мох, второй — коричневый, третий — глина. */
const PEBBLE = [PAPER_INK.moss, PAPER_INK.brown, PAPER_INK.clay];

export function drawGratitudeCard(
  canvas: HTMLCanvasElement,
  items: string[],
  dateLabel: string,
) {
  const maxW = CARD_W - CARD_PAD * 2;
  const textMaxW = maxW - ITEM_PAD * 2 - MARK_W;
  const shown = items.slice(0, MAX_ITEMS);
  const wrapped = shown.map((t) =>
    measureClamp(canvas, t, textMaxW, 14, MAX_LINES),
  );
  const { heights: panelHeights, total: bodyH } = panelStack(
    wrapped.map((lines) => lines.length),
    { lineH: LINE_H, pad: ITEM_PAD, gap: ITEM_GAP },
  );

  const H = headerHeight(1, true) + bodyH + 20 + FOOTER_H;

  const c = beginCard(canvas, H, { hue: CARD_LOOK.gratitude.hue });
  const { ctx } = c;

  const contentY = header(c, {
    eyebrow: 'Дневник благодарности',
    title: 'Благодарность',
    subtitle: dateLabel,
    sign: CARD_LOOK.gratitude.sign,
  });

  let y = contentY;
  wrapped.forEach((lines, i) => {
    const h = panelHeights[i];
    panel(c, CARD_PAD, y, maxW, h, 16);

    ctx.fillStyle = PEBBLE[i % PEBBLE.length];
    ctx.beginPath();
    ctx.ellipse(
      CARD_PAD + ITEM_PAD + 8,
      y + ITEM_PAD + 7,
      8,
      5.2,
      -0.31,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    let ty = y + ITEM_PAD + 11;
    for (const line of lines) {
      ctx.font = cardFont(14);
      ctx.fillStyle = INK.text;
      ctx.fillText(line, CARD_PAD + ITEM_PAD + MARK_W, ty);
      ty += LINE_H;
    }

    y += h + ITEM_GAP;
  });

  footer(c, 'Дневник благодарности');
}
