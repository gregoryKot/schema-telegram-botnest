// Чистая логика трекера «один вопрос на экран»: куда идти после ответа и
// «Пропустить», что показать на экране «Готово». Тестируется отдельно от React.
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { dayIndex } from '../../../../shared/src/needs/dayIndex';
import { fmtIndex } from '../../sections/today/todayFeed';

type Ratings = Record<string, number>;

/** Задержка перед автопереходом: успеть увидеть выбранный ответ. */
export const AUTO_ADVANCE_MS = 250;

const isRated = (ratings: Ratings, id: string) => (ratings[id] ?? 0) > 0;

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

/** Фраза-наблюдение под индексом дня. Название потребности — в нижнем регистре. */
export function lowestObservation(needName: string): string {
  return `Ниже всего — ${needName.toLowerCase()}. Не вывод, а точка: посмотрим, повторится ли.`;
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
