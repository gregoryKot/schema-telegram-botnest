// Библиотека раздела «Практика»: подписи карточек. Данные карточек —
// shared/src/exercises/exerciseCatalog (один источник рубрики и длительности
// для шапок упражнений и «Поставить цель»). «Давность» карточки — fmtAgo из
// shared (utils/format), своей копии здесь нет (правило №11). Экраны самих
// упражнений — components/exercises/*.
export { EXERCISES, type ExId } from '../../../../shared/src/exercises/exerciseCatalog';
export interface ExStats { count: number; lastDone: string | null; }

export function fmtCount(n: number): string {
  if (n === 1) return `1 запись`;
  if (n < 5) return `${n} записи`;
  return `${n} записей`;
}
