// Карточка ПОЛНОЙ записи дневника режимов — все заполненные поля (ситуация,
// мысли, чувства, тело, действия, что было нужно, откуда знакомо, слова
// Здорового Взрослого), а не только healthyResponse (см. modeEntryCard.ts —
// краткая карточка остаётся первичной). Вторичная опция «поделиться всей
// записью»: пользователь явно выбирает более откровенный вариант шаринга,
// с тем же превью (ShareCardSheet).
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
import { modeEntryFullShareText } from '../shareTexts';
import type { ShareCardKind } from '../analytics';
import {
  MODE_DIARY_FIELD_KEYS,
  type ModeDiaryFieldKey,
} from '../../mode/modeDiarySteps';
import { modeEntryShareProps, type ModeEntryMode } from './modeEntryCard';

/** Подписи полей на карточке — короткие, form-agnostic (номинатив). */
const FIELD_LABELS: Record<ModeDiaryFieldKey, string> = {
  situation: 'Ситуация',
  thoughts: 'Мысли',
  feelings: 'Чувства',
  bodyFeelings: 'Тело',
  actions: 'Действия',
  actualNeed: 'Что было нужно',
  childhoodMemories: 'Откуда знакомо',
};

/** Значения полей записи — совместим и с ModeEntrySaveData, и с ModeDiaryEntry (nullable). */
export type ModeEntryFullSource = {
  [K in ModeDiaryFieldKey]?: string | null;
} & { healthyResponse?: string | null };

export interface ModeEntryFullField {
  label: string;
  text: string;
}

/** Только заполненные поля, в порядке шагов дневника, ЗВ — последним. */
export function modeEntryFullFields(
  entry: ModeEntryFullSource,
): ModeEntryFullField[] {
  const fields: ModeEntryFullField[] = [];
  for (const key of MODE_DIARY_FIELD_KEYS) {
    const text = entry[key]?.trim();
    if (text) fields.push({ label: FIELD_LABELS[key], text });
  }
  const healthy = entry.healthyResponse?.trim();
  if (healthy) fields.push({ label: 'Здоровый Взрослый', text: healthy });
  return fields;
}

/** Есть ли в записи хоть одно заполненное поле, кроме healthyResponse — решает,
 * показывать ли фронту опцию «поделиться всей записью». */
export function hasModeEntryFullContent(entry: ModeEntryFullSource): boolean {
  return MODE_DIARY_FIELD_KEYS.some((key) => Boolean(entry[key]?.trim()));
}

export interface ModeEntryFullCardData {
  /** CSS-переменная или hex — цвет группы режима (акцент, как в краткой карточке). */
  color: string;
  name: string;
  emoji: string;
  /** дата записи, если известна */
  dateLabel?: string;
  fields: ModeEntryFullField[];
}

const LINE_H = 20;
const PAD_IN = 14;
const LABEL_BLOCK = 22;
const FIELD_GAP = 16;
const MAX_LINES_PER_FIELD = 5;

/** Готовит поля с уже перенесённым текстом (высота — заранее). */
function prepareFields(
  canvas: HTMLCanvasElement,
  fields: ModeEntryFullField[],
) {
  const textW = CARD_W - CARD_PAD * 2 - PAD_IN * 2;
  return fields.map((f) => ({
    label: f.label,
    lines: clampLines(
      measureWrap(canvas, f.text, textW, 14),
      MAX_LINES_PER_FIELD,
    ),
  }));
}

export function drawModeEntryFullCard(
  canvas: HTMLCanvasElement,
  d: ModeEntryFullCardData,
) {
  const shown = prepareFields(canvas, d.fields);
  const bodyH = shown.reduce(
    (s, f) =>
      s + LABEL_BLOCK + PAD_IN * 2 + f.lines.length * LINE_H + FIELD_GAP,
    0,
  );
  const H = headerHeight(1, Boolean(d.dateLabel)) + bodyH + 10 + FOOTER_H;
  const c = beginCard(canvas, H, { accent: d.color });
  const { ctx, th } = c;
  const panelW = c.W - CARD_PAD * 2;

  let y = header(c, {
    eyebrow: 'Дневник режимов',
    title: `${d.emoji} ${d.name}`,
    subtitle: d.dateLabel,
  });

  for (const f of shown) {
    y = sectionLabel(c, f.label, y + 4, c.accent);
    const panelH = PAD_IN * 2 + f.lines.length * LINE_H;
    panel(c, CARD_PAD, y, panelW, panelH, 16);

    ctx.font = cardFont(14);
    ctx.fillStyle = th.fg(0.85);
    ctx.textAlign = 'left';
    let ty = y + PAD_IN + 11;
    for (const line of f.lines) {
      ctx.fillText(line, CARD_PAD + PAD_IN, ty);
      ty += LINE_H;
    }
    y += panelH + FIELD_GAP;
  }

  footer(c, 'Дневник режимов');
}

/**
 * Общий конфиг ShareCardSheet для полной записи (правило №11 — не дублируем
 * между фронтами). `hint` — подпись-предупреждение под кнопкой-триггером во
 * фронте: на полной карточке уходит вся запись, не только слова ЗВ.
 */
export function modeEntryFullShareProps(
  mode: ModeEntryMode,
  entry: ModeEntryFullSource,
  link: string,
  dateLabel?: string,
) {
  const fields = modeEntryFullFields(entry);
  return {
    title: 'Поделиться записью',
    hint: 'На полной карточке — вся запись целиком.',
    filename: 'mode-entry-full.png',
    eventKind: 'mode_entry_full' as ShareCardKind,
    shareText: modeEntryFullShareText(link),
    draw: (canvas: HTMLCanvasElement) =>
      drawModeEntryFullCard(canvas, {
        color: mode.groupColor,
        name: mode.name,
        emoji: mode.emoji,
        dateLabel,
        fields,
      }),
  };
}

export interface ModeEntryShareOptions {
  /** Есть краткая карточка (нужны mode + healthyResponse). */
  hasHealthy: boolean;
  /** Есть опция «вся запись» (нужны mode + поле, кроме healthyResponse). */
  hasFull: boolean;
  shortProps: ReturnType<typeof modeEntryShareProps> | null;
  fullProps: ReturnType<typeof modeEntryFullShareProps> | null;
}

/**
 * Что показывать в ModeEntryShare (оба фронта, правило №11): считает оба
 * флага и готовит оба набора пропсов ShareCardSheet — компонент остаётся
 * тонким JSX без своей ветвящейся логики.
 */
export function modeEntryShareOptions(
  mode: ModeEntryMode | undefined,
  healthyResponse: string | null | undefined,
  entry: ModeEntryFullSource | undefined,
  link: string,
  dateLabel?: string,
): ModeEntryShareOptions {
  const hasHealthy = Boolean(mode && healthyResponse);
  const hasFull = Boolean(mode && entry && hasModeEntryFullContent(entry));
  return {
    hasHealthy,
    hasFull,
    shortProps:
      hasHealthy && mode && healthyResponse
        ? modeEntryShareProps(mode, healthyResponse, link)
        : null,
    fullProps:
      hasFull && mode && entry
        ? modeEntryFullShareProps(mode, entry, link, dateLabel)
        : null,
  };
}
