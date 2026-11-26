// Разбор поля цены в админке. Раньше пустое поле превращалось в
// `Math.max(0, Math.round(Number('')))` = 0 и уходило на сервер: цена платной
// сессии становилась 0 ₽ (у подписки — 1 ₽). Пустое и нечисловое значение —
// не цена: null, и кнопка «Сохранить» не активна.

/** Потолок совпадает с PRICE_MAX на сервере (src/booking/price-rules.ts). */
export const PRICE_MAX = 1_000_000;

/** Текст поля → целое число рублей в границах `min…max`, иначе null. */
export function parsePriceInput(raw: string, min: number, max = PRICE_MAX): number | null {
  const text = raw.trim();
  if (text === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : null;
}
