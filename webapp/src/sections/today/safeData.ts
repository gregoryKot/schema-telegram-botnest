// Ответы API, которые по контракту массивы. При сбое сервер или прокси может
// отдать `{}`/null — тогда экран «Сегодня» показывает пусто, а не падает
// с «e is not iterable» (пользователь видел сырую страницу ошибки роутера).

export type HistoryDays = Array<{
  date: string;
  ratings: Record<string, number>;
}>;

export function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Строки истории без даты или без оценок пропускаются: по ним нечего считать. */
export function cleanHistoryDays(
  value: HistoryDays | null | undefined,
): HistoryDays {
  return asArray(value).filter(
    (d) =>
      !!d &&
      typeof d.date === 'string' &&
      !!d.ratings &&
      typeof d.ratings === 'object',
  );
}
