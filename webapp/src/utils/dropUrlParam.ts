// Убрать из адреса один параметр, не трогая остальное: метки визита
// (`utm_source`, `yclid`) и фрагмент остаются. Раньше возврат с оплаты в
// BookingPicker чистил адрес целиком (`pathname + hash`) и уносил метки вместе
// с `?payment=ok`; ссылка управления подпиской так же теряла фрагмент.
// Запись истории заменяется, а не добавляется: «Назад» не вернёт параметр.
export function dropUrlParam(name: string): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
