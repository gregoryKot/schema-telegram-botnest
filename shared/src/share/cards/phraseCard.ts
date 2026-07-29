// Карточка фразы Здорового Взрослого: крупная цитата — герой карточки,
// декоративная кавычка сверху задаёт настроение, минимум остального.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  footer,
  sectionLabel,
  measureWrap,
  drawWrapped,
  clampLines,
  withAlpha,
} from '../cardKit';

const QUOTE_SIZE = 20;
const QUOTE_LINE_H = 30;
const QUOTE_MAX_LINES = 7;
const EYEBROW_Y = 44;
const GLYPH_SIZE = 76;
const GLYPH_GAP = 76; // место под декоративную кавычку до первой строки цитаты
// Воздух под последней строкой цитаты. Считается от базовой линии последней
// строки (а не от «следующей»), иначе внизу карточки повисает пустая строка.
const BOTTOM_GAP = 36;

export function drawPhraseCard(canvas: HTMLCanvasElement, phrase: string) {
  const maxW = CARD_W - CARD_PAD * 2;
  const text = `«${phrase}»`;
  const lines = clampLines(
    measureWrap(canvas, text, maxW, QUOTE_SIZE, 'bold'),
    QUOTE_MAX_LINES,
  );
  const quoteStartY = EYEBROW_Y + GLYPH_GAP;
  const H =
    quoteStartY + (lines.length - 1) * QUOTE_LINE_H + BOTTOM_GAP + FOOTER_H;

  const c = beginCard(canvas, H, {
    accent: 'var(--accent-green)',
    accent2: 'var(--accent-blue)',
  });
  const { ctx, th } = c;

  sectionLabel(c, 'Фраза Здорового Взрослого', EYEBROW_Y, c.accent);

  // Декоративная кавычка над цитатой — задаёт тон, не мешает чтению.
  ctx.font = `italic bold ${GLYPH_SIZE}px Georgia, serif`;
  ctx.fillStyle = withAlpha(c.accent, 0.22);
  ctx.textAlign = 'left';
  ctx.fillText('“', CARD_PAD - 6, EYEBROW_Y + 66);

  drawWrapped(c, text, CARD_PAD, quoteStartY, maxW, {
    size: QUOTE_SIZE,
    weight: 'bold',
    color: th.fg(0.95),
    lineH: QUOTE_LINE_H,
    maxLines: QUOTE_MAX_LINES,
  });

  footer(c, 'Поддержка себе');
}
