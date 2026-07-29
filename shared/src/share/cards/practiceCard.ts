// Карточка быстрой практики «Здесь и сейчас» (дыхание, заземление, «Стоп»):
// шаги — статичный контент из practices/quickPractices.ts, без пользователь-
// ского текста, поэтому карточку можно рисовать без превью-подтверждения.
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

export interface PracticeCardStep {
  emoji: string;
  title: string;
}

export interface PracticeCardData {
  emoji: string;
  title: string;
  subtitle: string;
  steps: PracticeCardStep[];
}

const BADGE = 24;
const STEP_X = CARD_PAD + BADGE + 10;
const LINE_H = 20;
const STEP_GAP = 14;
const COUNT_H = 34;

export function drawPracticeCard(
  canvas: HTMLCanvasElement,
  practice: PracticeCardData,
  countLabel: string | null,
): void {
  const maxW = CARD_W - CARD_PAD - STEP_X;
  const wrapped = practice.steps.map((s) =>
    clampLines(measureWrap(canvas, s.title, maxW, 14), 2),
  );
  const bodyH = wrapped.reduce(
    (s, lines) => s + Math.max(lines.length, 1) * LINE_H + STEP_GAP,
    0,
  );
  const countH = countLabel ? COUNT_H : 0;
  const H = 120 + bodyH + countH + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;

  accentBar(c, '#4fa3f7', '#06d6a0');
  header(c, `${practice.emoji} ${practice.title}`, practice.subtitle);

  let y = 128;
  practice.steps.forEach((step, i) => {
    const lines = wrapped[i];
    const rowH = Math.max(lines.length, 1) * LINE_H;

    // Плашка с номером шага
    ctx.fillStyle = th.fg(0.07);
    ctx.beginPath();
    ctx.roundRect(CARD_PAD, y - 15, BADGE, BADGE, 8);
    ctx.fill();
    ctx.font = cardFont(11, 'bold');
    ctx.fillStyle = th.fg(0.5);
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), CARD_PAD + BADGE / 2, y - 15 + BADGE / 2 + 4);
    ctx.textAlign = 'left';

    // Эмодзи шага + название (обёрнутое)
    ctx.font = '14px serif';
    ctx.fillText(step.emoji, STEP_X, y);
    let ly = y;
    for (const line of lines) {
      ctx.font = cardFont(14);
      ctx.fillStyle = th.fg(0.88);
      ctx.fillText(line, STEP_X + 22, ly);
      ly += LINE_H;
    }

    y += rowH + STEP_GAP;
  });

  if (countLabel) {
    ctx.font = cardFont(13, 'bold');
    ctx.fillStyle = '#06d6a0';
    ctx.textAlign = 'center';
    ctx.fillText(countLabel, W / 2, y + 6);
    ctx.textAlign = 'left';
  }

  footer(c, 'Здесь и сейчас');
}
