// Карточка «моя карточка схемы/режима» — все ЗАПОЛНЕННЫЕ поля заметки
// (UserSchemaNote / UserModeNote), пустые не рисуются вообще. Та же вёрстка,
// что у полной записи дневника режимов (modeEntryFullCard.ts) — панель на
// поле, обрезка длинного текста, высота считается заранее.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  measureWrap,
  clampLines,
  footer,
} from '../cardKit';
import { fieldPanels, fieldPanelsHeight } from '../kit/fieldPanels';

/** Объединение ключей UserSchemaNote и UserModeNote (prisma/schema.prisma). */
export type NoteFieldKey =
  | 'triggers'
  | 'feelings'
  | 'thoughts'
  | 'origins'
  | 'reality'
  | 'healthyView'
  | 'behavior'
  | 'modeFunction'
  | 'needs'
  | 'needsMet';

/**
 * Подписи полей от первого лица: без обращения к читателю и без рода —
 * поэтому вилка форм обращения им не нужна вовсе. Формулировки
 * совпадают по смыслу с вопросами, которые видел человек при заполнении:
 * SchemaIntroSheet.QUESTIONS (schema-miniapp) и buildModeIntroQuestions
 * (shared/src/mode/modeIntroQuestions.ts).
 */
export const NOTE_FIELD_LABELS: Record<NoteFieldKey, string> = {
  triggers: 'Что включает',
  feelings: 'Что чувствую',
  thoughts: 'Какие мысли',
  origins: 'Откуда это',
  reality: 'Как на самом деле',
  healthyView: 'Взгляд Здорового Взрослого',
  behavior: 'Что делаю',
  modeFunction: 'От чего защищает',
  needs: 'Что на самом деле нужно',
  needsMet: 'Даёт ли то, что нужно',
};

/** Порядок полей карточки схемы — совпадает с шагами SchemaIntroSheet. */
export const SCHEMA_NOTE_FIELD_ORDER: NoteFieldKey[] = [
  'triggers',
  'feelings',
  'thoughts',
  'origins',
  'reality',
  'healthyView',
  'behavior',
];

/** Порядок полей карточки режима — совпадает с buildModeIntroQuestions. */
export const MODE_NOTE_FIELD_ORDER: NoteFieldKey[] = [
  'triggers',
  'feelings',
  'thoughts',
  'behavior',
  'modeFunction',
  'needs',
  'needsMet',
  'origins',
  'healthyView',
];

export interface NoteCardField {
  label: string;
  text: string;
}

/** Значения заметки — совместимо и с UserSchemaNote, и с UserModeNote (обе
 * модели держат поля пустой строкой по умолчанию, а не null). */
export type NoteFieldSource = Partial<
  Record<NoteFieldKey, string | null | undefined>
>;

/** Только заполненные поля заметки, в заданном порядке — пустые не попадают
 * в карточку вообще (см. требование «пустые поля не рисуются»). */
export function noteCardFields(
  order: NoteFieldKey[],
  source: NoteFieldSource,
): NoteCardField[] {
  const fields: NoteCardField[] = [];
  for (const key of order) {
    const text = source[key]?.trim();
    if (text) fields.push({ label: NOTE_FIELD_LABELS[key], text });
  }
  return fields;
}

export interface NoteCardData {
  /** CSS-переменная или hex — цвет домена схемы / группы режима. */
  color: string;
  /** Название схемы/режима. */
  title: string;
  /** Домен схемы или группа режима. */
  subtitle?: string;
  /** Только заполненные поля — построй через noteCardFields. */
  fields: NoteCardField[];
}

const PAD_IN = 14;
const MAX_LINES_PER_FIELD = 5;

/** Готовит поля с уже перенесённым текстом (высота — заранее, до beginCard). */
function prepareFields(canvas: HTMLCanvasElement, fields: NoteCardField[]) {
  const textW = CARD_W - CARD_PAD * 2 - PAD_IN * 2;
  return fields.map((f) => ({
    label: f.label,
    lines: clampLines(
      measureWrap(canvas, f.text, textW, 14),
      MAX_LINES_PER_FIELD,
    ),
  }));
}

export function drawNoteCard(canvas: HTMLCanvasElement, d: NoteCardData) {
  const maxW = CARD_W - CARD_PAD * 2;
  const titleLines = clampLines(
    measureWrap(canvas, d.title, maxW, 23, 'bold'),
    2,
  );
  const shown = prepareFields(canvas, d.fields);
  const bodyH = fieldPanelsHeight(shown);
  const H = headerHeight(titleLines.length, false) + bodyH + 10 + FOOTER_H;
  const c = beginCard(canvas, H, { accent: d.color });
  const y = header(c, { eyebrow: d.subtitle, title: d.title });

  fieldPanels(c, shown, y);

  footer(c, 'Моя карточка');
}
