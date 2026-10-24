/**
 * Ответ вне рублей про оплату: онлайн-оплаты нет, договариваются после записи
 * (решение владельца 2026-10-20). Рублёвый ответ про Robokassa и чек самозанятого
 * остаётся в FAQ_ITEMS.
 */
export const FAQ_PRICE_ABROAD =
  'Вводная встреча (15 минут) – бесплатно. Каждая следующая сессия (50 минут) – {PRICE}. Об оплате договоримся после записи: напишу, какие способы вам доступны.';

/** Подставляет цену в ответ; ответы с {PRICE} вне рублей заменяются на FAQ_PRICE_ABROAD. */
export function faqAnswer(answer: string, price: string, online: boolean): string {
  if (!answer.includes('{PRICE}')) return answer;
  return (online ? answer : FAQ_PRICE_ABROAD).replace('{PRICE}', price);
}
