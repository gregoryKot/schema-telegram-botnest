// Вид шага «Моего пути» (docs/archive/APP_2026-11.md, b22-journey, `JOURNEY_SIGN`): знак и бумага —
// сущности шага из ENTITY_LOOK (JOURNEY_ENTITY), а не эмодзи и неон journeyMeta. Один источник для
// строки ленты, плитки счётчика и шапки детали. Шаг на одну потребность («Что питает», шаг плана) —
// бумага и знак потребности (needLook); режим — небо дневника режимов, знак группы режима (как в ленте
// «Записей», b11), без группы — Cluster. Группу режима знает площадка (данные режимов), сюда — функцией.
import { NEED_ORDER, type NeedId } from '../needs/types';
import {
  ENTITY_LOOK,
  JOURNEY_ENTITY,
  needLook,
  type Look,
  type SignKey,
} from '../theme/entityLook';
import type { JourneyItem, JourneyItemType } from './journeyMeta';

/** Вид шага: бумага и знак; `n` — вариант мотива по счёту (countedSigns.ts). */
export type JourneyLook = Look & { n?: number };

/** Благодарность — `Pebbles filled` (решение владельца №2): лёг один камешок, два — гнёзда, как у тега
 *  «Благодарность»; «Заметка дня» — обычные три камешка. Сколько «спасибо» в записи, лента не знает —
 *  поэтому знак, а не данные. */
const STEP_N: Partial<Record<JourneyItemType, number>> = { gratitude: 1 };

/** Колесо детства — счётчик без записи в ленте (journeyStats); вид — ENTITY_LOOK.childhood_wheel. */
export const CHILDHOOD_STAT = 'childhood_wheel';

const NEED_STEP = new Set(['practice', 'plan_done']);
const MODE_STEP = new Set(['mode_diary', 'mode_note']);
const NEED_IDS: readonly string[] = NEED_ORDER;

/** Бумага и знак строки ENTITY_LOOK, без сцены «готово». */
const paper = ({ hue, sign }: Look): Look => ({ hue, sign });

/** ENTITY_LOOK[JOURNEY_ENTITY[type]] — знак и бумага сущности шага (с вариантом мотива). */
function stepLook(type: JourneyItemType): JourneyLook {
  const look = paper(ENTITY_LOOK[JOURNEY_ENTITY[type]]);
  const n = STEP_N[type];
  return n === undefined ? look : { ...look, n };
}

/** Вид строки ленты; незнакомый тип с бэка — null (строка без картинки, без выдуманного знака). */
export function journeyItemLook(
  item: Pick<JourneyItem, 'type' | 'needId' | 'modeId'>,
  modeSign?: (modeId: string) => SignKey,
): JourneyLook | null {
  if (!Object.hasOwn(JOURNEY_ENTITY, item.type)) return null;
  const look = stepLook(item.type as JourneyItemType);
  if (NEED_STEP.has(item.type) && item.needId && NEED_IDS.includes(item.needId))
    return needLook(item.needId as NeedId);
  if (MODE_STEP.has(item.type) && item.modeId && modeSign)
    return { hue: look.hue, sign: modeSign(item.modeId) };
  return look;
}

/** Вид плитки счётчика: сущность занятия; колесо детства — своя сущность. */
export const journeyStatLook = (type: string): JourneyLook | null =>
  type === CHILDHOOD_STAT
    ? paper(ENTITY_LOOK.childhood_wheel)
    : journeyItemLook({ type });
