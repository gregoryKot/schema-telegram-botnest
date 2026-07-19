// Реестр продуктовых событий (правило №8 CLAUDE.md). Источник правды для
// бэка: DTO валидирует name/kind по этим allow-list'ам, сервис пишет только
// известные события. Фронтовые вызовы api.trackEvent должны слать те же имена
// (парный список в схожем виде на фронтах — при добавлении события синхронь).
//
// meta — маленький СТРУКТУРНЫЙ non-PII объект. НИКОГДА не класть свободный
// текст пользователя (он не шифруется, см. комментарий модели AnalyticsEvent).

// Разрешённые имена событий.
//   share_card          — нажал «Поделиться» на карточке (meta.kind);
//   share_result        — исход системного шэра (meta.kind + meta.ok);
//   crisis_card_shown   — показалась карточка помощи (meta.surface);
//   crisis_hotline_tapped — нажал на телефон доверия (meta.surface);
//   outbox_flush        — доехали записи, сделанные без интернета (meta.count);
//   today_focus_change  — сменил главную практику экрана «Сегодня» (meta.practice);
//   today_streak_toggle — скрыл/показал счётчик серии (meta.hidden);
//   breath_start        — запустил дыхание «Здесь и сейчас» (без meta).
export const ANALYTICS_EVENTS = [
  'share_card',
  'share_result',
  'crisis_card_shown',
  'crisis_hotline_tapped',
  'outbox_flush',
  'today_focus_change',
  'today_streak_toggle',
  'breath_start',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

// Тип карточки для событий share_card / share_result (meta.kind).
export const SHARE_CARD_KINDS = [
  'weekly',
  'day',
  'achievement',
  'streak',
  'schema',
  'diary',
  'ysq',
] as const;
export type ShareCardKind = (typeof SHARE_CARD_KINDS)[number];

// Экран, на котором показалась кризисная карточка (meta.surface для
// crisis_*). Без свободного текста — только перечислимый источник (правило №7).
export const CRISIS_SURFACES = [
  'schema',
  'mode',
  'gratitude',
  'note',
  'practice',
] as const;
export type CrisisSurface = (typeof CRISIS_SURFACES)[number];

// Главная практика экрана «Сегодня» (meta.practice для today_focus_change) —
// парно с FocusPractice на фронте (schema-miniapp/src/utils/todayFocus.ts).
export const TODAY_FOCUS_PRACTICES = [
  'tracker',
  'schema',
  'mode',
  'gratitude',
] as const;
export type TodayFocusPractice = (typeof TODAY_FOCUS_PRACTICES)[number];
