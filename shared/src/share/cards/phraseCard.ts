// Карточка фразы Здорового Взрослого в editorial-стиле сайта: бумажный фон
// без свечений, приглушённая рубрика с короткой линией-акцентом и цитата
// serif-шрифтом темы — единственный герой карточки.
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
} from '../cardKit';
import { HEALTHY_ADULT_CHANNEL_HANDLE } from '../channelLinks';
import { resolveCardTheme } from '../kit/theme';

const QUOTE_SIZE = 26;
const QUOTE_LINE_H = 34;
const QUOTE_MAX_LINES = 8;
const EYEBROW_Y = 44;
const QUOTE_START_Y = 104;
// Воздух под последней строкой цитаты. Считается от базовой линии последней
// строки (а не от «следующей»), иначе внизу карточки повисает пустая строка.
const BOTTOM_GAP = 40;

export function drawPhraseCard(canvas: HTMLCanvasElement, phrase: string) {
  const maxW = CARD_W - CARD_PAD * 2;
  const serif = resolveCardTheme().serif;
  const text = `«${phrase}»`;
  const lines = clampLines(
    measureWrap(canvas, text, maxW, QUOTE_SIZE, undefined, serif),
    QUOTE_MAX_LINES,
  );
  const H =
    QUOTE_START_Y + (lines.length - 1) * QUOTE_LINE_H + BOTTOM_GAP + FOOTER_H;

  const c = beginCard(canvas, H, { glow: false });
  const { ctx, th } = c;

  sectionLabel(c, 'Здоровый Взрослый', EYEBROW_Y, th.fg(0.5));
  ctx.fillStyle = c.accent;
  ctx.fillRect(CARD_PAD, EYEBROW_Y + 12, 28, 2);

  drawWrapped(c, text, CARD_PAD, QUOTE_START_Y, maxW, {
    size: QUOTE_SIZE,
    family: serif,
    color: th.fg(0.92),
    lineH: QUOTE_LINE_H,
    maxLines: QUOTE_MAX_LINES,
  });

  footer(c, '', { brand: HEALTHY_ADULT_CHANNEL_HANDLE });
}
