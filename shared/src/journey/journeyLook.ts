// Вид шага «Моего пути» (docs/design/APP_2026-11.md, b22-journey, `JOURNEY_SIGN`): знак и бумага —
// сущности шага из ENTITY_LOOK (JOURNEY_ENTITY), а не эмодзи и неон journeyMeta. Один источник для
// строки ленты, плитки счётчика и шапки детали. Шаг на одну потребность («Что питает», шаг плана) —
// бумага и знак потребности (needLook); режим — небо дневника режимов, знак группы режима (как в ленте
// «Записей», b11), без группы — Cluster. Группу режима знает площадка (данные режимов), сюда — функцией.
// Таблицы — литералами: рантайм-импорт entityLook в лист «Мой путь» (его берут «Профиль» и «Ещё»)
// перекраивал чанки — CSS упражнений вставал раньше index.css (check-css-link-order, как outcomeLook.ts).
// Сверка с ENTITY_LOOK, JOURNEY_ENTITY и needLook — journeyLook.test.ts (правило №4).
import type { Look, SignKey } from '../theme/entityLook';
import type { JourneyItem, JourneyItemType } from './journeyMeta';

/** Вид шага: бумага и знак; `n` — вариант мотива по счёту (countedSigns.ts). */
export type JourneyLook = Look & { n?: number };

/** ENTITY_LOOK[JOURNEY_ENTITY[type]] — знак и бумага сущности шага. Благодарность — `Pebbles filled`
 *  (решение владельца №2): лёг один камешок, два — гнёзда, как у тега «Благодарность»; «Заметка дня» —
 *  обычные три камешка. Сколько «спасибо» в записи, лента не знает — поэтому знак, а не данные. */
export const JOURNEY_LOOK: Readonly<Record<JourneyItemType, JourneyLook>> = {
  tracker_day: { hue: 70, sign: 'strokes' },
  note: { hue: 70, sign: 'pebbles' },
  schema_diary: { hue: 28, sign: 'layers' },
  mode_diary: { hue: 240, sign: 'cluster' },
  gratitude: { hue: 195, sign: 'pebbles', n: 1 },
  practice: { hue: 145, sign: 'leaf' },
  plan_done: { hue: 135, sign: 'check' },
  ysq: { hue: 28, sign: 'layers' },
  belief_check: { hue: 70, sign: 'scales' },
  letter: { hue: 290, sign: 'sheets' },
  flashcard: { hue: 25, sign: 'heart' },
  safe_place: { hue: 135, sign: 'haven' },
  schema_note: { hue: 28, sign: 'layers' },
  mode_note: { hue: 240, sign: 'cluster' },
  breathing: { hue: 195, sign: 'breath' },
  grounding: { hue: 135, sign: 'grounded' },
  stop: { hue: 70, sign: 'pause' },
};

/** needLook(id) — бумага NEED_HUE и знак потребности. */
export const JOURNEY_NEED_LOOK: Readonly<Record<string, Look>> = {
  attachment: { hue: 28, sign: 'need_attachment' },
  autonomy: { hue: 70, sign: 'need_autonomy' },
  limits: { hue: 135, sign: 'need_limits' },
  expression: { hue: 240, sign: 'need_expression' },
  play: { hue: 310, sign: 'need_play' },
};

/** Колесо детства — счётчик без записи в ленте (journeyStats); вид — ENTITY_LOOK.childhood_wheel. */
export const CHILDHOOD_STAT = 'childhood_wheel';
export const CHILDHOOD_LOOK: Look = { hue: 45, sign: 'wheel' };

const NEED_STEP = new Set(['practice', 'plan_done']);
const MODE_STEP = new Set(['mode_diary', 'mode_note']);

/** Вид строки ленты; незнакомый тип с бэка — null (строка без картинки, без выдуманного знака). */
export function journeyItemLook(
  item: Pick<JourneyItem, 'type' | 'needId' | 'modeId'>,
  modeSign?: (modeId: string) => SignKey,
): JourneyLook | null {
  if (!Object.hasOwn(JOURNEY_LOOK, item.type)) return null;
  const look = JOURNEY_LOOK[item.type as JourneyItemType];
  if (
    NEED_STEP.has(item.type) &&
    item.needId &&
    Object.hasOwn(JOURNEY_NEED_LOOK, item.needId)
  )
    return JOURNEY_NEED_LOOK[item.needId];
  if (MODE_STEP.has(item.type) && item.modeId && modeSign)
    return { hue: look.hue, sign: modeSign(item.modeId) };
  return look;
}

/** Вид плитки счётчика: сущность занятия; колесо детства — своя сущность. */
export const journeyStatLook = (type: string): JourneyLook | null =>
  type === CHILDHOOD_STAT ? CHILDHOOD_LOOK : journeyItemLook({ type });

/** Поля-голос Здорового Взрослого (вставка мха в детали) — те же, что в ленте «Записей» (entryRows.ts). */
const HEALTHY_TITLES = new Set(['Здоровый взгляд', 'Здоровый Взрослый']);
export const isHealthyPart = (title: string | undefined): boolean =>
  HEALTHY_TITLES.has(title ?? '');
