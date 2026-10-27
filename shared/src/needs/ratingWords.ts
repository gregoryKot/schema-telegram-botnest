// Шкала трекера словами (простой клиент, этап 2). В данных остаётся оценка
// 1–10 (POST /api/rating принимает 0–10): пять ответов пишут чётные значения
// 2/4/6/8/10, а старые оценки 1–10 показываются ближайшим словом.
export interface RatingWord {
  /** Значение, которое уходит на сервер. */
  value: number;
  label: string;
}

export const RATING_WORDS: readonly RatingWord[] = [
  { value: 2, label: 'Совсем нет' },
  { value: 4, label: 'Мало' },
  { value: 6, label: 'Наполовину' },
  { value: 8, label: 'В основном да' },
  { value: 10, label: 'Полностью' },
];

/** Слово для оценки: 1–2 → первое, 3–4 → второе … 9–10 → пятое. Нет оценки (0, undefined) — null. */
export function wordForValue(v: number | null | undefined): RatingWord | null {
  if (v === null || v === undefined || !(v >= 1)) return null;
  return RATING_WORDS[Math.min(RATING_WORDS.length, Math.ceil(v / 2)) - 1];
}
