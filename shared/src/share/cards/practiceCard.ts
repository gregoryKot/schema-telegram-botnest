// Карточка быстрой практики «Здесь и сейчас» (дыхание, заземление, «Стоп»):
// шаги — статичный контент из practices/quickPractices.ts, без пользователь-
// ского текста, поэтому карточку можно рисовать без превью-подтверждения.
// Каждый шаг — панель с номером, эмодзи и названием; внизу, если счётчик
// известен, строка «прошли N раз».
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  panel,
  panelStack,
  drawEmoji,
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

const ITEM_PAD = 13;
const ITEM_GAP = 10;
const LINE_H = 20;
const MAX_LINES = 2;
const BADGE_W = 22;
const EMOJI_W = 26;
const COUNT_H = 34;

export function drawPracticeCard(
  canvas: HTMLCanvasElement,
  practice: PracticeCardData,
  countLabel: string | null,
): void {
  const maxW = CARD_W - CARD_PAD * 2;
  const textMaxW = maxW - ITEM_PAD * 2 - BADGE_W - EMOJI_W;
  const wrapped = practice.steps.map((s) =>
    clampLines(measureWrap(canvas, s.title, textMaxW, 14), MAX_LINES),
  );
  const { heights: panelHeights, total: bodyH } = panelStack(
    wrapped.map((lines) => lines.length),
    { lineH: LINE_H, pad: ITEM_PAD, gap: ITEM_GAP },
  );
  const countH = countLabel ? COUNT_H : 0;

  const H = headerHeight(1, true) + bodyH + countH + 20 + FOOTER_H;

  const c = beginCard(canvas, H, {
    accent: 'var(--accent-blue)',
    accent2: 'var(--accent-green)',
  });
  const { ctx, th } = c;

  const contentY = header(c, {
    eyebrow: 'Здесь и сейчас',
    title: `${practice.emoji} ${practice.title}`,
    subtitle: practice.subtitle,
  });

  let y = contentY;
  wrapped.forEach((lines, i) => {
    const h = panelHeights[i];
    panel(c, CARD_PAD, y, maxW, h, 16);

    const baseline = y + ITEM_PAD + 11;

    // Номер шага — порядок в практике важен, шаги идут строго друг за другом.
    ctx.font = cardFont(11, 'bold');
    ctx.fillStyle = c.accent;
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, CARD_PAD + ITEM_PAD, baseline);

    drawEmoji(
      c,
      practice.steps[i].emoji,
      CARD_PAD + ITEM_PAD + BADGE_W,
      baseline,
      14,
    );

    let ty = baseline;
    for (const line of lines) {
      ctx.font = cardFont(14);
      ctx.fillStyle = th.fg(0.88);
      ctx.fillText(line, CARD_PAD + ITEM_PAD + BADGE_W + EMOJI_W, ty);
      ty += LINE_H;
    }

    y += h + ITEM_GAP;
  });

  if (countLabel) {
    ctx.font = cardFont(13, 'bold');
    ctx.fillStyle = c.accent;
    ctx.textAlign = 'center';
    ctx.fillText(countLabel, CARD_W / 2, y + 16);
    ctx.textAlign = 'left';
  }

  footer(c, 'Здесь и сейчас');
}
