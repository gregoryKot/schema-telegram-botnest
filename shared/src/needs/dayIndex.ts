/**
 * Индекс дня — среднее по всем потребностям; пока не все оценены — null (не
 * выдумываем число). Единственная копия: главная «Сегодня», экран «Готово»
 * трекера и сигнал моста к терапевту считают его одной формулой.
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
