// Карточка быстрой практики «Здесь и сейчас» (дыхание, заземление, «Стоп»):
// шаги — статичный контент из practices/quickPractices.ts, без пользователь-
// ского текста, поэтому карточку можно рисовать без превью-подтверждения.
// Лист оттенка практики со знаком (ENTITY_LOOK: дыхание — Breath на бирюзе),
// лид переносится целиком, шаги — строки на бумаге с номером Literata; внизу,
// если счётчик известен, строка «прошли N раз».
import {
  CARD_LOOK,
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  INK,
  beginCard,
  cardFont,
  divider,
  footer,
  header,
  headerLines,
  measureClamp,
  serifFont,
  type CardEntity,
  type HeaderOpts,
} from '../cardKit';

export interface PracticeCardStep {
  emoji: string;
  title: string;
}

export interface PracticeCardData {
  /** id быстрой практики (breathing, grounding, stop) — оттенок и знак листа. */
  id?: string;
  emoji: string;
  title: string;
  subtitle: string;
  steps: PracticeCardStep[];
}

const ROW_PAD = 11;
const LINE_H = 20;
const MAX_LINES = 2;
const NUM_W = 30;
const COUNT_H = 36;
const LEAD_LINES = 5;

/** Вид листа практики: своя сущность ENTITY_LOOK, незнакомая — дыхание. */
export function practiceLook(id: string | undefined) {
  const key: CardEntity =
    id === 'grounding' || id === 'stop' ? id : 'breathing';
  return CARD_LOOK[key];
}

export function drawPracticeCard(
  canvas: HTMLCanvasElement,
  practice: PracticeCardData,
  countLabel: string | null,
): void {
  const look = practiceLook(practice.id);
  const head: HeaderOpts = {
    eyebrow: 'Здесь и сейчас',
    title: practice.title,
    subtitle: practice.subtitle,
    subtitleLines: LEAD_LINES,
    sign: look.sign,
  };
  const textMaxW = CARD_W - CARD_PAD * 2 - NUM_W;
  const wrapped = practice.steps.map((s) =>
    measureClamp(canvas, s.title, textMaxW, 14.5, MAX_LINES),
  );
  const rowsH = wrapped.reduce(
    (h, l) => h + l.length * LINE_H + ROW_PAD * 2,
    0,
  );
  const headH = headerLines(canvas.getContext('2d')!, head).height;
  const H = headH + rowsH + (countLabel ? COUNT_H : 6) + FOOTER_H - 8;

  const c = beginCard(canvas, H, { hue: look.hue });
  const { ctx } = c;
  let y = header(c, head) - 8;

  wrapped.forEach((lines, i) => {
    if (i > 0) divider(c, y);
    const base = y + ROW_PAD + 15;
    // Номер шага — порядок в практике важен, шаги идут строго друг за другом.
    ctx.textAlign = 'left';
    ctx.font = serifFont(20);
    ctx.fillStyle = c.accent;
    ctx.fillText(String(i + 1), CARD_PAD, base + 1);
    ctx.font = cardFont(14.5);
    ctx.fillStyle = INK.text;
    lines.forEach((line, j) =>
      ctx.fillText(line, CARD_PAD + NUM_W, base + j * LINE_H),
    );
    y += lines.length * LINE_H + ROW_PAD * 2;
  });

  if (countLabel) {
    ctx.font = cardFont(13, 'bold');
    ctx.fillStyle = c.accent;
    ctx.fillText(countLabel, CARD_PAD, y + 26);
  }

  footer(c, 'Здесь и сейчас');
}
