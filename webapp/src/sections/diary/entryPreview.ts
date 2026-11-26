// Превью записи в ленте «Записи». Запись в 6700 знаков выводилась целиком и
// превращалась в простыню на экран и больше (QA 2026-11, A-М9). В закрытой
// карточке — начало текста до границы слова; целиком — по нажатию на карточку.

/** Сколько знаков видно в закрытой карточке (~4 строки на десктопе). */
export const PREVIEW_MAX = 280;
/** Насколько раньше предела можно резать, чтобы не рвать слово. */
const WORD_SLACK = 40;

export function clipPreview(text: string, max = PREVIEW_MAX): { text: string; clipped: boolean } {
  if (text.length <= max) return { text, clipped: false };
  const cut = text.slice(0, max);
  const space = cut.search(/\s\S*$/);
  const head = space >= max - WORD_SLACK ? cut.slice(0, space) : cut;
  return { text: head.replace(/[\s.,;:!?—–-]+$/, '') + '…', clipped: true };
}
