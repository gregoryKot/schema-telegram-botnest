/**
 * Пределы длины пользовательского текста — ЕДИНСТВЕННОЕ место на бэкенде
 * (находка аудита 2026-10-11, backend#29).
 *
 * Лимит стоит в DTO (`@MaxLength`) и больше нигде: превышение — 400 от
 * глобального ValidationPipe. Раньше контроллеры дополнительно резали поле
 * `.slice(0, N)` с другим N — заметка на 6000 знаков отвечала 201 и теряла
 * хвост молча. Гейт `scripts/check-body-truncation.mjs` держит это в CI.
 *
 * Значения зеркалятся фронтендами (`shared/src/limits/textLimits.ts`, имя в
 * имя): textarea с `maxLength` и счётчиком остатка. Расхождение двух копий
 * ловит `text-limits.parity.spec.ts` (правило №4 CLAUDE.md).
 */
export const SESSION_NOTE_MAX = 10000; // заметка терапевта по сессии
export const DAY_NOTE_MAX = 500; // заметка к дню в трекере (счётчик «N/500» в обоих фронтах)
export const DIARY_FIELD_MAX = 10000; // поле записи дневника / пункт благодарности
export const PRACTICE_TEXT_MAX = 200; // своя практика в плане
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
export const BOOKING_SLOT_MESSAGE_MAX = 2000; // запись на слот (/api/booking/book): запрос
export const CLIENT_NAME_MAX = 100; // имя/псевдоним клиента у терапевта (добавление офлайн-клиента и переименование)
export const TASK_TEXT_MAX = 10000; // «Своё задание»: текст задания (терапевта клиенту или своей цели)
