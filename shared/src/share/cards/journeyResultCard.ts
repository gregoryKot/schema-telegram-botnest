// Карточка-результат шага «Моего пути»: заголовок с эмодзи и датой + сам
// заполненный текст (убеждение, письмо, практика…) блоками — рубрика цветом
// карточки и текст на панели, а не сплошным столбиком. Свободный текст
// попадает на картинку только по явному тапу пользователя, с превью перед
// отправкой (тот же принцип, что у карточки благодарности).
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  panel,
  sectionLabel,
  measureWrap,
  clampLines,
  cardFont,
  footer,
} from '../cardKit';
import type { JourneyResultPart } from '../../journey/journeyContent';

export interface JourneyResultCardData {
  emoji: string;
  label: string;
  day: string;
  hex: string;
  parts: JourneyResultPart[];
}

const LINE_H = 21;
const PAD_IN = 14;
const LABEL_BLOCK = 22;
const PART_GAP = 16;
const MAX_LINES_PER_PART = 4;
const MAX_PARTS = 3;

/** Готовит до 3 частей с уже перенесённым текстом (высота — заранее). */
function prepareParts(canvas: HTMLCanvasElement, parts: JourneyResultPart[]) {
  const textW = CARD_W - CARD_PAD * 2 - PAD_IN * 2;
  return parts.slice(0, MAX_PARTS).map((p) => ({
    title: p.title,
    lines: clampLines(
      measureWrap(canvas, p.text, textW, 14),
      MAX_LINES_PER_PART,
    ),
  }));
}

export function drawJourneyResultCard(
  canvas: HTMLCanvasElement,
  d: JourneyResultCardData,
) {
  const shown = prepareParts(canvas, d.parts);
  const bodyH = shown.reduce(
    (s, p) =>
      s +
      (p.title ? LABEL_BLOCK : 0) +
      PAD_IN * 2 +
      p.lines.length * LINE_H +
      PART_GAP,
    0,
  );
  const H = headerHeight(1, true) + bodyH + 10 + FOOTER_H;
  const c = beginCard(canvas, H, { accent: d.hex });
  const { ctx, th } = c;

  const panelW = c.W - CARD_PAD * 2;
  let y = header(c, {
    eyebrow: 'Мой путь',
    title: `${d.emoji} ${d.label}`,
    subtitle: d.day,
  });

  for (const p of shown) {
    if (p.title) y = sectionLabel(c, p.title, y + 4, c.accent);
    const panelH = PAD_IN * 2 + p.lines.length * LINE_H;
    panel(c, CARD_PAD, y, panelW, panelH, 16);

    ctx.font = cardFont(14);
    ctx.fillStyle = th.fg(0.85);
    ctx.textAlign = 'left';
    let ty = y + PAD_IN + 11;
    for (const line of p.lines) {
      ctx.fillText(line, CARD_PAD + PAD_IN, ty);
      ty += LINE_H;
    }
    y += panelH + PART_GAP;
  }

  footer(c, 'Мой путь');
}
