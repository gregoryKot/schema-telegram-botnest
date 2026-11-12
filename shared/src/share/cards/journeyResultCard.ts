// Карточка-результат шага «Моего пути» (b23b): лист сущности шага, шапка со знаком сущности
// (journeyItemLook) и датой, затем сам заполненный текст (убеждение, письмо, практика…) блоками
// «тихая подпись + светлая плашка»; «Здоровый взгляд» и «Здоровый Взрослый» — вставка мха, как
// голос Здорового Взрослого в детали приложения. Свободный текст попадает на картинку только по
// явному тапу пользователя, с превью перед отправкой (тот же принцип, что у карточки благодарности).
import {
  CARD_W,
  CARD_PAD,
  CARD_LOOK,
  FOOTER_H,
  beginCard,
  footer,
  header,
  measureClamp,
  headerLines,
} from '../cardKit';
import {
  PANEL_PAD_IN,
  fieldPanels,
  fieldPanelsHeight,
  type PanelField,
} from '../kit/fieldPanels';
import type { JourneyResultPart } from '../../journey/journeyContent';
import { isHealthyPart } from '../../journey/journeyLook';

export interface JourneyResultCardData {
  label: string;
  day: string;
  /** Бумага и знак сущности шага (journeyItemLook); незнакомый тип — null. */
  hue: number | null;
  sign: string | null;
  parts: JourneyResultPart[];
}

const MAX_LINES_PER_PART = 4;
const MAX_PARTS = 3;

/** До 3 частей с уже перенесённым текстом (высота — заранее); голос ЗВ — мхом. */
export function resultFields(
  canvas: HTMLCanvasElement,
  parts: JourneyResultPart[],
): PanelField[] {
  const textW = CARD_W - CARD_PAD * 2 - PANEL_PAD_IN * 2;
  return parts.slice(0, MAX_PARTS).map((p) => ({
    label: p.title ?? '',
    lines: measureClamp(canvas, p.text, textW, 14, MAX_LINES_PER_PART),
    healthy: isHealthyPart(p.title),
  }));
}

export function drawJourneyResultCard(
  canvas: HTMLCanvasElement,
  d: JourneyResultCardData,
) {
  const fields = resultFields(canvas, d.parts);
  const head = {
    eyebrow: 'Мой путь',
    title: d.label,
    subtitle: d.day,
    sign: d.sign ?? undefined,
  };
  const lines = headerLines(canvas.getContext('2d')!, head);
  const H = lines.height + fieldPanelsHeight(fields) + FOOTER_H - 6;
  const c = beginCard(canvas, H, { hue: d.hue ?? CARD_LOOK.journey.hue });
  fieldPanels(c, fields, header(c, head, lines));
  footer(c, 'Мой путь');
}
