// Длинное имя в шапке карточки клиента (b30): «Константин Константинопольский-Задунайский (супервизия, вторник)»
// на телефоне в две строки кегля ds-h2 не помещалось и обрезалось многоточием — целиком его не было видно нигде.
// Длинное имя (больше LONG букв с пробелами) — второй кегль засечного ds-h3 (своих кеглей у заголовков нет,
// oneStyle.test.ts) и на телефоне до четырёх строк (tk-name--long, therapist-card.css); обычное — ds-h2, как было.

/** «Игорь Валентинович Преображенский» (33) встаёт в две строки ds-h2 и на 390 — длинным не считается. */
const LONG = 40;

export function isLongClientName(name: string): boolean {
  return name.trim().length > LONG;
}

/** Классы заголовка имени. */
export function clientNameClass(name: string): string {
  return isLongClientName(name) ? 'ds-h3 tk-name tk-name--long' : 'ds-h2 tk-name';
}
