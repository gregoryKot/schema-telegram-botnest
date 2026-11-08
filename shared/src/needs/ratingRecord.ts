// «Оценена ли потребность» — одна проверка на все экраны: 0 и отсутствие ключа
// значат одно и то же, «не оценено» (шкала 1–10, 0 сервер не принимает). Часть
// экранов смотрела на `!== undefined`, часть на `> 0`, и откат отклонённой
// оценки к «не было» рисовал плитку отмеченной (аудит 2026-11, E4).

export function isRated(
  ratings: Readonly<Record<string, number | null | undefined>>,
  id: string,
): boolean {
  return (ratings[id] ?? 0) > 0;
}

/** Оценки с новым значением: больше 0 — ставится, 0 — ключ убирается. */
export function withRating(
  ratings: Readonly<Record<string, number>>,
  id: string,
  value: number,
): Record<string, number> {
  if (value > 0) return { ...ratings, [id]: value };
  const { [id]: _cleared, ...rest } = ratings;
  return rest;
}
