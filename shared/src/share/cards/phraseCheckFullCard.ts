// Карточка ПОЛНОГО разбора фразы: вердикт, все отмеченные приметы критика,
// исходная фраза и переписанная. Краткая карточка (phraseCheckCard.ts)
// остаётся первичной — она про результат; полная показывает, из чего вердикт
// собрался, и это более откровенный вариант шаринга (выбирается явно).
import {
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  panel,
  sectionLabel,
  cardFont,
  footer,
} from '../cardKit';
import {
  QUOTE_LABEL_BLOCK,
  QUOTE_PAD_IN,
  VOICE_CARE,
  VOICE_CRITIC,
  drawQuoteBlock,
  quoteBlockHeight,
  quoteLines,
} from './quoteBlock';
import { phraseCheckFullShareText } from '../shareTexts';
import type { ShareCardKind } from '../analytics';
import { PHRASE_CRITERIA, type PhraseMarkId } from '../../phraseCheck/criteria';
import { buildVerdict } from '../../phraseCheck/verdict';
import { phraseCheckShareProps } from './phraseCheckCard';

const BLOCK_GAP = 14;
const MARK_LINE_H = 22;
const MAX_LINES = 4;
const TEXT_SIZE = 14;

export interface PhraseCheckFullCardData {
  phrase: string;
  marks: PhraseMarkId[];
  rewrite?: string;
}

/** Отмеченные приметы короткими подписями, в порядке таблицы. */
export function phraseCheckMarkLabels(marks: PhraseMarkId[]): string[] {
  const set = new Set(marks);
  return PHRASE_CRITERIA.filter((c) => set.has(c.id)).map((c) => c.short);
}

export function drawPhraseCheckFullCard(
  canvas: HTMLCanvasElement,
  d: PhraseCheckFullCardData,
) {
  const verdict = buildVerdict(d.marks);
  const labels = phraseCheckMarkLabels(d.marks);
  const was = quoteLines(canvas, d.phrase, TEXT_SIZE, MAX_LINES);
  const now = d.rewrite?.trim()
    ? quoteLines(canvas, d.rewrite, TEXT_SIZE, MAX_LINES)
    : null;
  const marksH = QUOTE_PAD_IN * 2 + Math.max(labels.length, 1) * MARK_LINE_H;

  const H =
    headerHeight(1, true) +
    QUOTE_LABEL_BLOCK +
    quoteBlockHeight(was) +
    BLOCK_GAP +
    QUOTE_LABEL_BLOCK +
    marksH +
    BLOCK_GAP +
    (now ? QUOTE_LABEL_BLOCK + quoteBlockHeight(now) + BLOCK_GAP : 0) +
    10 +
    FOOTER_H;

  const c = beginCard(canvas, H, {
    accent: labels.length > 0 ? VOICE_CRITIC : VOICE_CARE,
  });
  const { ctx, th } = c;
  const panelW = c.W - CARD_PAD * 2;

  let y = header(c, {
    eyebrow: 'Разбор фразы',
    title: `${verdict.emoji} ${verdict.title}`,
    subtitle: `${labels.length} из ${PHRASE_CRITERIA.length} примет критика`,
  });

  const opts = { size: TEXT_SIZE, gap: BLOCK_GAP };
  y = drawQuoteBlock(c, y, {
    label: 'Было',
    lines: was,
    color: VOICE_CRITIC,
    ...opts,
  });

  y = sectionLabel(
    c,
    'Что нашлось',
    y + 4,
    labels.length ? VOICE_CRITIC : VOICE_CARE,
  );
  panel(c, CARD_PAD, y, panelW, marksH, 16);
  ctx.font = cardFont(TEXT_SIZE);
  ctx.textAlign = 'left';
  let my = y + QUOTE_PAD_IN + 12;
  if (labels.length === 0) {
    ctx.fillStyle = th.fg(0.85);
    ctx.fillText('ни одной приметы критика', CARD_PAD + QUOTE_PAD_IN, my);
  } else {
    for (const label of labels) {
      ctx.fillStyle = th.fg(0.55);
      ctx.fillText('•', CARD_PAD + QUOTE_PAD_IN, my);
      ctx.fillStyle = th.fg(0.85);
      ctx.fillText(label, CARD_PAD + QUOTE_PAD_IN + 16, my);
      my += MARK_LINE_H;
    }
  }
  y += marksH + BLOCK_GAP;

  if (now) {
    drawQuoteBlock(c, y, {
      label: 'Стало',
      lines: now,
      color: VOICE_CARE,
      ...opts,
    });
  }

  footer(c, 'Разбор фразы');
}

/** Общий конфиг ShareCardSheet для полного разбора. */
export function phraseCheckFullShareProps(
  phrase: string,
  marks: PhraseMarkId[],
  rewrite: string | undefined,
  link: string,
) {
  return {
    title: 'Поделиться разбором',
    hint: 'На полной карточке — фраза, все найденные приметы и переписанный вариант.',
    filename: 'phrase-check-full.png',
    eventKind: 'phrase_check_full' as ShareCardKind,
    shareText: phraseCheckFullShareText(link),
    draw: (canvas: HTMLCanvasElement) =>
      drawPhraseCheckFullCard(canvas, { phrase, marks, rewrite }),
  };
}

export interface PhraseCheckShareOptions {
  /** Краткая карточка «было → стало» — нужна переписанная фраза. */
  hasShort: boolean;
  /** Полный разбор — нужна хотя бы сама фраза. */
  hasFull: boolean;
  shortProps: ReturnType<typeof phraseCheckShareProps> | null;
  fullProps: ReturnType<typeof phraseCheckFullShareProps> | null;
}

/**
 * Что показывать в блоке шаринга (оба фронта, правило №11): считает флаги и
 * готовит оба набора пропсов — компонент остаётся тонким JSX.
 */
export function phraseCheckShareOptions(
  phrase: string | null | undefined,
  marks: PhraseMarkId[],
  rewrite: string | null | undefined,
  link: string,
): PhraseCheckShareOptions {
  const text = phrase?.trim() ?? '';
  const rewritten = rewrite?.trim() ?? '';
  const hasFull = text.length > 0;
  const hasShort = hasFull && rewritten.length > 0;
  return {
    hasShort,
    hasFull,
    shortProps: hasShort ? phraseCheckShareProps(text, rewritten, link) : null,
    fullProps: hasFull
      ? phraseCheckFullShareProps(text, marks, rewritten || undefined, link)
      : null,
  };
}
