/**
 * Индекс дня — среднее по всем потребностям; пока не все оценены — null (не
 * выдумываем число). Единственная копия: главная «Сегодня», экран «Готово»
 * трекера, колесо истории и сигнал моста к терапевту считают его одной формулой.
 */
export function dayIndex(
  needIds: readonly string[],
  ratings: Record<string, number>,
): number | null {
  if (needIds.length === 0 || needIds.some((id) => ratings[id] === undefined)) {
    return null;
  }
  return needIds.reduce((s, id) => s + ratings[id], 0) / needIds.length;
}

/**
 * Индекс для показа: «6,4» — десятичная запятая, как принято в русском
 * тексте; нет индекса — «—». Одна функция на все экраны (QA 2026-11, B-М3:
 * плитка писала «6,4», колесо истории и сайдбар — «6.4»).
 */
export function fmtIndex(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(1).replace('.', ',');
}
