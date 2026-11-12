// Сводная карточка достижений (b23b): значки как в профиле — знак достижения на бумажке своего
// оттенка с тенью-вырезкой (ACHIEVEMENT_LOOK → achievementCardLook); неполученный — силуэт: тихая
// бумага листа без второго слоя и знак одним тоном. Под сеткой — полоска «N из M».
import {
  CARD_PAD,
  CARD_W,
  FOOTER_H,
  INK,
  achievementCardLook,
  beginCard,
  cardFont,
  drawDrawing,
  drawingHeight,
  lookDrawing,
  footer,
  header,
  headerHeight,
  paperSlip,
  progressBar,
  serifFont,
  silhouetteHex,
  type Card,
} from '../cardKit';

export interface AchievementsCardItem {
  /** id достижения (ACHIEVEMENT_META) — по нему знак и оттенок значка. */
  id: string;
  earned: boolean;
}

/** Лист сводки — шалфей «готово» (ENTITY_LOOK, исход «готово» 135): значки собраны. Бумага профиля
 *  (195) совпала бы со значком «Хороший день» (лист профиля), и он пропадал бы на листе. */
const SHEET_HUE = 135;
const PER_ROW = 4;
const GAP = 12;
const TILE = (CARD_W - CARD_PAD * 2 - GAP * (PER_ROW - 1)) / PER_ROW;
const SIGN_W = 50;
const SIGN_BOX = 38;

/** Ряды сетки: по PER_ROW значков, неполный последний — по центру. Чистая. */
export function achievementRows<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += PER_ROW)
    rows.push(items.slice(i, i + PER_ROW));
  return rows;
}

const gridHeight = (rows: number) =>
  rows ? rows * TILE + (rows - 1) * GAP : 0;

/** Значок: бумажка своего оттенка со знаком; неполученный — силуэт на тихой бумаге листа. */
function drawBadge(c: Card, item: AchievementsCardItem, x: number, y: number) {
  const look = achievementCardLook(item.id);
  const hue = look?.hue ?? c.hue;
  if (item.earned) paperSlip(c, x, y, TILE, TILE, hue, { r: 16 });
  else
    paperSlip(c, x, y, TILE, TILE, c.hue, {
      r: 16,
      fill: c.sunk,
      shadow: false,
    });
  const d = lookDrawing(look);
  if (!d) return;
  const h0 = drawingHeight(d, SIGN_W);
  const w = h0 > SIGN_BOX ? (SIGN_W * SIGN_BOX) / h0 : SIGN_W;
  const h = drawingHeight(d, w);
  drawDrawing(
    c.ctx,
    d,
    x + (TILE - w) / 2,
    y + (TILE - h) / 2,
    w,
    item.earned ? undefined : { tone: silhouetteHex(c.hue) },
  );
}

export function drawAchievementsCard(
  canvas: HTMLCanvasElement,
  items: AchievementsCardItem[],
) {
  const rows = achievementRows(items);
  const earned = items.filter((i) => i.earned).length;
  const total = items.length;
  const gridH = gridHeight(rows.length);

  const H = headerHeight(1, true) + gridH + 30 + 8 + 40 + FOOTER_H;
  const c = beginCard(canvas, H, { hue: SHEET_HUE });
  const { ctx } = c;

  const top = header(c, {
    eyebrow: 'Достижения',
    title: 'Мои достижения',
    subtitle: `собрано ${earned} из ${total}`,
  });

  rows.forEach((row, r) => {
    const rowW = row.length * TILE + (row.length - 1) * GAP;
    const x0 = (c.W - rowW) / 2;
    row.forEach((item, i) =>
      drawBadge(c, item, x0 + i * (TILE + GAP), top + r * (TILE + GAP)),
    );
  });

  const barY = top + gridH + 30;
  progressBar(
    c,
    CARD_PAD,
    barY,
    c.W - CARD_PAD * 2,
    total > 0 ? earned / total : 0,
    c.accent,
  );

  const textY = barY + 36;
  ctx.textAlign = 'left';
  ctx.font = serifFont(20);
  ctx.fillStyle = INK.text;
  ctx.fillText(`${earned} из ${total}`, CARD_PAD, textY);
  ctx.font = cardFont(13);
  ctx.fillStyle = INK.sub;
  ctx.textAlign = 'right';
  ctx.fillText(
    total > 0 ? `${Math.round((earned / total) * 100)}%` : '0%',
    c.W - CARD_PAD,
    textY,
  );
  ctx.textAlign = 'left';

  footer(c, 'Достижения');
}
