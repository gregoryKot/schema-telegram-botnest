// Чистая логика трекера «один вопрос на экран»: куда идти после ответа и
// «Пропустить», что показать на экране «Готово». Тестируется отдельно от React.
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { dayIndex, fmtIndex } from '../../../../shared/src/needs/dayIndex';
import { isRated } from '../../../../shared/src/needs/ratingRecord';

type Ratings = Record<string, number>;

/** Задержка перед автопереходом: успеть увидеть выбранный ответ. */
export const AUTO_ADVANCE_MS = 250;


/**
 * Индекс следующей неоценённой потребности после `from`. `wrap` — искать и
 * с начала списка (после ответа: пропущенное ранее всё равно ждёт ответа).
 * Нет такой — null.
 */
export function nextUnrated(ids: string[], ratings: Ratings, from: number, wrap: boolean): number | null {
  for (let i = from + 1; i < ids.length; i++) if (!isRated(ratings, ids[i])) return i;
  if (wrap) for (let i = 0; i <= Math.min(from, ids.length - 1); i++) if (!isRated(ratings, ids[i])) return i;
  return null;
}

export interface DaySummary {
  filled: number;
  total: number;
  /** Индекс дня — только когда оценены все. */
  index: number | null;
  /** Потребность с самой низкой оценкой (при равенстве — первая по NEED_ORDER); только когда оценены все. */
  lowestId: string | null;
}

const orderOf = (id: string) => {
  const i = (NEED_ORDER as readonly string[]).indexOf(id);
  return i < 0 ? NEED_ORDER.length : i;
};

export function summarizeDay(ids: string[], ratings: Ratings): DaySummary {
  const rated: Ratings = {};
  for (const id of ids) if (isRated(ratings, id)) rated[id] = ratings[id];
  const filled = Object.keys(rated).length;
  const all = ids.length > 0 && filled === ids.length;
  let lowestId: string | null = null;
  if (all) {
    lowestId = [...ids].sort((a, b) => rated[a] - rated[b] || orderOf(a) - orderOf(b))[0];
  }
  return { filled, total: ids.length, index: dayIndex(ids, rated), lowestId };
}

/** Насколько самая низкая оценка ниже следующей — с этого разрыва потребность «заметно ниже» остальных. */
export const STANDS_OUT_GAP = 2;

export interface LowestPicture {
  /** Все потребности с самой низкой оценкой (порядок ids). */
  lowIds: string[];
  /** Все пять на одном уровне. */
  allEqual: boolean;
  /** Одна потребность ниже остальных минимум на STANDS_OUT_GAP — повод для следующего шага. */
  standsOut: boolean;
}

/** Картина низа дня; только когда оценены все (иначе null — не выдумываем). */
export function lowestPicture(ids: string[], ratings: Ratings): LowestPicture | null {
  if (ids.length === 0 || ids.some((id) => !isRated(ratings, id))) return null;
  const min = Math.min(...ids.map((id) => ratings[id]));
  const lowIds = ids.filter((id) => ratings[id] === min);
  const rest = ids.filter((id) => ratings[id] !== min).map((id) => ratings[id]);
  const next = rest.length ? Math.min(...rest) : min;
  return { lowIds, allEqual: rest.length === 0, standsOut: lowIds.length === 1 && next - min >= STANDS_OUT_GAP };
}

/**
 * Фраза-наблюдение под индексом дня. Названия — в нижнем регистре. Равные ответы не дают
 * «ниже всего — одна»: все на одном уровне или называются все самые низкие.
 */
export function lowestObservation(lowNames: string[], allEqual = false): string {
  if (allEqual) return 'Все пять сегодня на одном уровне. Не вывод, а точка: посмотрим, что будет дальше.';
  const names = lowNames.map((n) => n.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}` : names[0];
  return `Ниже всего — ${list}. Не вывод, а точка: посмотрим, повторится ли.`;
}

/** Самая низкая держится не первый день — та же мысль, что в «Истории» (`persistentLowNeeds`). */
export function persistentLowNote(needName: string): string {
  return `${needName} низко уже не первый день.`;
}

/** Один следующий шаг: низко не первый день — практика под потребность (если она есть), иначе — разобрать, что задело. */
export type NextStep = 'case' | 'practice';
export function completionNextStep(standsOut: boolean, persistent: boolean, hasPractice: boolean): NextStep | null {
  if (!standsOut) return null;
  return persistent && hasPractice ? 'practice' : 'case';
}

export interface CompletionHeadline {
  /** Крупная строка: индекс дня или «N из M». */
  big: string;
  caption: string;
  aria: string;
}

/** Заголовок экрана «Готово»: индекс — только когда оценены все, иначе сколько заполнено. */
export function completionHeadline(filled: number, total: number, index: number | null): CompletionHeadline {
  if (index === null) {
    const big = `${filled} из ${total}`;
    return { big, caption: 'заполнено', aria: `Заполнено ${big}` };
  }
  return { big: fmtIndex(index), caption: 'индекс дня из 10', aria: `Индекс дня ${fmtIndex(index)} из 10` };
}
