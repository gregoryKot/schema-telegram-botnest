// Карточка записи дневника режимов — «голос моего Здорового Взрослого».
// На картинку попадают ТОЛЬКО режим + слова самоподдержки, которые клиент
// написал сам (healthyResponse). Сырую ситуацию/мысли НЕ выносим (приватность):
// карточка — то, что хочется перечитывать «когда накроет», и безопасно делиться.
// Только по явному тапу на записи, с превью (ShareCardSheet).
//
// Переиспользуем drawSchemaCard (правило №11): та же вёрстка «эйбрау → название
// → блок текста → футер». Эйбрау «Голос Здорового Взрослого» задаёт рамку,
// сами слова клиента идут телом.
import { drawSchemaCard } from './schemaCard';
import { modeEntryShareText } from '../shareTexts';
import type { ShareCardKind } from '../analytics';

export interface ModeEntryCardData {
  group: string;
  /** CSS-переменная или hex — резолвится китом */
  color: string;
  name: string;
  emoji: string;
  /** слова Здорового Взрослого — пишет клиент сам */
  healthyResponse: string;
}

export function drawModeEntryCard(
  canvas: HTMLCanvasElement,
  d: ModeEntryCardData,
) {
  drawSchemaCard(canvas, {
    domain: 'Голос Здорового Взрослого',
    domainColor: d.color,
    name: `${d.emoji} ${d.name}`,
    desc: d.healthyResponse,
    footerLabel: 'Дневник режимов',
  });
}

/** Форма режима, нужная карточке (общая для обоих фронтов). */
export interface ModeEntryMode {
  name: string;
  emoji: string;
  groupName: string;
  groupColor: string;
}

/**
 * Общий конфиг ShareCardSheet для записи режима (правило №11 — не дублируем
 * рисовалку/текст/вид между фронтами). Каждый фронт добавляет только свой
 * триггер (SharePill / кнопка) и onClose.
 */
export function modeEntryShareProps(
  mode: ModeEntryMode,
  healthyResponse: string,
  link: string,
) {
  return {
    title: 'Сохранить карточку',
    filename: 'mode-entry.png',
    eventKind: 'mode_entry' as ShareCardKind,
    shareText: modeEntryShareText(link),
    draw: (canvas: HTMLCanvasElement) =>
      drawModeEntryCard(canvas, {
        group: mode.groupName,
        color: mode.groupColor,
        name: mode.name,
        emoji: mode.emoji,
        healthyResponse,
      }),
  };
}
