// Слаги источника регистрации для атрибуции платных посевов в Telegram-каналах
// (см. docs/archive/PROJECT_AUDIT.md — стратегия запуска). Ссылка на посев
// имеет вид `t.me/<bot>?start=src_<slug>`, разбор — parseSourceSlug в
// src/telegram/start-source.ts. Allow-list — правило №7 CLAUDE.md: свободный
// текст пользователя в meta аналитики недопустим, поэтому произвольный/
// неизвестный slug из ссылки нормализуется в 'other'. Вынесено отдельным
// файлом по образцу crisis-surfaces.constants.ts (правило №10: analytics.
// constants.ts держим ≤299 строк).
//
//   seed1      — первый оплаченный посев (канал/пост фиксируется в брифе на
//                конкретную закупку, слаг один на кампанию);
//   seed2      — второй оплаченный посев (следующая закупка);
//   channel    — органическая ссылка в закреплённом посте/описании
//                собственного канала «Здоровый Взрослый»;
//   therapist  — ссылка, которую партнёр-терапевт даёт своим клиентам;
//   other      — неизвестный/мусорный slug либо переход без метки (обычная
//                ссылка t.me/<bot> без ?start=).
export const SIGNUP_SOURCES = [
  'seed1',
  'seed2',
  'channel',
  'therapist',
  'other',
] as const;

export type SignupSource = (typeof SIGNUP_SOURCES)[number];
