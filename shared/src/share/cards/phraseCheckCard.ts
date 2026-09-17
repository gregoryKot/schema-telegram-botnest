// Краткая карточка разбора фразы: «было → стало». На картинку идут ровно две
// реплики — исходная фраза критика и переписанная. Приметы и вердикт остаются
// в полной карточке (phraseCheckFullCard.ts): краткая — про результат, её
// хочется перечитывать и не стыдно показать.
//
// Только по явному тапу, с превью (ShareCardSheet) — как у записи режима.
import { FOOTER_H, beginCard, header, headerHeight, footer } from '../cardKit';
import {
  QUOTE_LABEL_BLOCK,
  VOICE_CARE,
  VOICE_CRITIC,
  drawQuoteBlock,
  quoteBlockHeight,
  quoteLines,
} from './quoteBlock';
import { phraseCheckShareText } from '../shareTexts';
import type { ShareCardKind } from '../analytics';

export interface PhraseCheckCardData {
  /** Исходная реплика внутреннего голоса */
  phrase: string;
  /** Переписанная — то, ради чего упражнение и делается */
  rewrite: string;
}

const LINE_H = 21;
const BLOCK_GAP = 16;
const MAX_LINES = 5;
const TEXT_SIZE = 14.5;

export function drawPhraseCheckCard(
  canvas: HTMLCanvasElement,
  d: PhraseCheckCardData,
) {
  const was = quoteLines(canvas, d.phrase, TEXT_SIZE, MAX_LINES);
  const now = quoteLines(canvas, d.rewrite, TEXT_SIZE, MAX_LINES);
  const H =
    headerHeight(1, false) +
    QUOTE_LABEL_BLOCK +
    quoteBlockHeight(was, LINE_H) +
    BLOCK_GAP +
    QUOTE_LABEL_BLOCK +
    quoteBlockHeight(now, LINE_H) +
    10 +
    FOOTER_H;

  const c = beginCard(canvas, H, { accent: VOICE_CARE });
  let y = header(c, {
    eyebrow: 'Критик или забота',
    title: 'Одна фраза — два голоса',
  });

  const opts = { size: TEXT_SIZE, lineH: LINE_H, gap: BLOCK_GAP };
  y = drawQuoteBlock(c, y, {
    label: 'Было',
    lines: was,
    color: VOICE_CRITIC,
    ...opts,
  });
  drawQuoteBlock(c, y, {
    label: 'Стало',
    lines: now,
    color: VOICE_CARE,
    ...opts,
  });

  footer(c, 'Разбор фразы');
}

/** Общий конфиг ShareCardSheet (правило №11 — одна рисовалка на оба фронта). */
export function phraseCheckShareProps(
  phrase: string,
  rewrite: string,
  link: string,
) {
  return {
    title: 'Сохранить карточку',
    filename: 'phrase-check.png',
    eventKind: 'phrase_check' as ShareCardKind,
    shareText: phraseCheckShareText(link),
    draw: (canvas: HTMLCanvasElement) =>
      drawPhraseCheckCard(canvas, { phrase, rewrite }),
  };
}
