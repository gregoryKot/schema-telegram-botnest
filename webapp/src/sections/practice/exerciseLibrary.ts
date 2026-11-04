// Библиотека раздела «Практика»: оформление карточек. Данные карточек —
// shared/src/exercises/exerciseCatalog (один источник рубрики и длительности
// для шапок упражнений и «Поставить цель»). «Давность» карточки — fmtAgo из
// shared (utils/format), своей копии здесь нет (правило №11). Экраны самих
// упражнений — components/exercises/*.
export { EXERCISES, type ExId } from '../../../../shared/src/exercises/exerciseCatalog';
export interface ExStats { count: number; lastDone: string | null; }

/** Небольшая палитра оттенков библиотеки (hue из гаммы кабинета). */
export const LIBRARY_HUES = [28, 70, 135, 240, 310, 190] as const;

/** Оттенок карточки по порядку в библиотеке: палитра по кругу, без выдуманных данных. */
export function exerciseHue(index: number): number {
  const n = LIBRARY_HUES.length;
  return LIBRARY_HUES[((index % n) + n) % n];
}

export function fmtCount(n: number): string {
  if (n === 1) return `1 запись`;
  if (n < 5) return `${n} записи`;
  return `${n} записей`;
}
