/** Склейка «Подробнее» из продолжений с общей основой: пункт остаётся на первом месте, повторов нет. */
export const uniqueItems = (...lists: string[][]): string[] => [
  ...new Set(lists.flat()),
];
