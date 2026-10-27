// Пределы длины пользовательского текста на фронтах — зеркало
// `src/utils/text-limits.ts` бэкенда (имя в имя, значение в значение).
// Расхождение двух файлов роняет `src/utils/text-limits.parity.spec.ts`.
//
// Лимит один и стоит в DTO сервера: превышение там — 400. Раньше контроллеры
// молча резали хвост (`slice(0, N)`) с другим N, а поля ввода предела не
// показывали вовсе — заметка терапевта на шесть тысяч знаков «сохранялась»
// на пять (находка аудита 2026-10-11, backend#29). Теперь поле ввода
// получает `maxLength` отсюда и `CharCounter` показывает остаток.
export const SESSION_NOTE_MAX = 10000; // заметка терапевта по сессии
export const DAY_NOTE_MAX = 500; // заметка к дню в трекере (счётчик «N/500» в обоих фронтах)
export const DIARY_FIELD_MAX = 10000; // поле записи дневника / пункт благодарности
export const PRACTICE_TEXT_MAX = 200; // своя практика в плане
export const BOOKING_SLOT_MESSAGE_MAX = 2000; // запись на слот (/api/booking/book): запрос
export const MODE_MAP_TITLE_MAX = 120; // название карты режимов
export const CONCEPT_FIELD_TEXT_MAX = 5000; // концептуализация, вид «Поля»: каждое текстовое поле (цели, ранний опыт, триггеры…)
export const CONCEPT_MODE_ALIAS_MAX = 80; // графическая концептуализация: как режим называет клиент
export const CONCEPT_MODE_TEXT_MAX = 1000; // графическая концептуализация: истоки / проявления / работа с режимом
export const CONCEPT_SCHEMA_TEXT_MAX = 1000; // графическая концептуализация: убеждение схемы / как нарушалась потребность
export const CUSTOM_MODE_NAME_MAX = 80; // название своего режима на карте
export const CUSTOM_MODE_EMOJI_MAX = 8; // значок своего режима
export const THERAPIST_REQUEST_NAME_MAX = 100; // заявка «Я психолог»: ФИО
export const THERAPIST_REQUEST_QUAL_MAX = 500; // заявка «Я психолог»: квалификация
export const THERAPIST_REQUEST_CONTACTS_MAX = 200; // заявка «Я психолог»: контакты
export const THERAPIST_REQUEST_MESSAGE_MAX = 1000; // заявка «Я психолог»: сообщение админу
export const BOOKING_NAME_MAX = 100; // заявка с сайта: имя
export const BOOKING_CONTACT_MAX = 100; // заявка с сайта: контакт
export const BOOKING_MESSAGE_MAX = 500; // заявка с сайта: запрос
export const BOOKING_SOURCE_MAX = 200; // заявка с сайта: откуда (leadSource())
export const CLIENT_NAME_MAX = 100; // имя/псевдоним клиента у терапевта (добавление офлайн-клиента и переименование)
export const TASK_TEXT_MAX = 10000; // «Своё задание»: текст задания (терапевта клиенту или своей цели)

/** С какой доли заполнения показывать остаток: до этого счётчик — шум. */
export const COUNTER_FROM_RATIO = 0.8;

export interface CharCounterState {
  /** Сколько знаков ещё можно ввести (не меньше нуля). */
  left: number;
  /** Предел достигнут: дальше браузер ввод не пропустит. */
  atLimit: boolean;
}

/**
 * Состояние счётчика остатка. `null` — рано показывать: человеку с короткой
 * заметкой цифра ни к чему, а вот перед границей она обязана быть видна.
 * `always` — короткое поле, где предел часть замысла (заметка к дню, «N/500»):
 * счётчик виден с первого знака.
 */
export function charCounterState(
  length: number,
  max: number,
  always = false,
): CharCounterState | null {
  if (!always && length < Math.floor(max * COUNTER_FROM_RATIO)) return null;
  const left = Math.max(0, max - length);
  return { left, atLimit: left === 0 };
}
