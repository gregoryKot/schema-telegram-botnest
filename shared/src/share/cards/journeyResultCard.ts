// Карточка-результат шага «Моего пути»: заголовок с эмодзи и датой + сам
// заполненный текст (убеждение, письмо, практика…). Свободный текст попадает
// на картинку только по явному тапу на конкретной записи, с превью перед
// отправкой (тот же принцип, что у карточки благодарности).
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  header,
  measureWrap,
  clampLines,
  cardFont,
} from '../cardKit';
import { footer } from '../cardKit';
import type { JourneyResultPart } from '../../journey/journeyContent';

export interface JourneyResultCardData {
  emoji: string;
  label: string;
  day: string;
  hex: string;
  parts: JourneyResultPart[];
}

const LINE_H = 21;
const TITLE_H = 20;
const PART_GAP = 14;
const MAX_LINES_PER_PART = 4;

export function drawJourneyResultCard(
  canvas: HTMLCanvasElement,
  d: JourneyResultCardData,
) {
  const maxW = CARD_W - CARD_PAD * 2;
  const shown = d.parts.slice(0, 3).map((p) => ({
    title: p.title,
    lines: clampLines(
      measureWrap(canvas, p.text, maxW, 14),
      MAX_LINES_PER_PART,
    ),
  }));
  const bodyH = shown.reduce(
    (s, p) => s + (p.title ? TITLE_H : 0) + p.lines.length * LINE_H + PART_GAP,
    0,
  );
  const H = 120 + bodyH + 10 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, th } = c;

  accentBar(c, d.hex);
  header(c, `${d.emoji} ${d.label}`, d.day);

  let y = 128;
  for (const p of shown) {
    if (p.title) {
      ctx.font = cardFont(11);
      ctx.fillStyle = d.hex;
      ctx.textAlign = 'left';
      ctx.fillText(p.title.toUpperCase(), CARD_PAD, y);
      y += TITLE_H;
    }
    for (const line of p.lines) {
      ctx.font = cardFont(14);
      ctx.fillStyle = th.fg(0.85);
      ctx.fillText(line, CARD_PAD, y);
      y += LINE_H;
    }
    y += PART_GAP;
  }

  footer(c, 'Мой путь');
}
