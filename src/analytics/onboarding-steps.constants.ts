// Шаги обучающего онбординга мини-аппа (meta.step для onboarding_step).
// Порядок = порядок показа: по нему строится воронка «докуда доходят».
// 'done' — нажал финальную кнопку. Парный список на фронте:
// shared/src/share/analytics.ts (при добавлении шага синхронь оба).
//
// Отдельным файлом — по тому же поводу, что SHARE_CARD_KINDS и CRISIS_SURFACES
// (правило №10: файл сверх потолка обязан таять, а не расти вместе со списком).
//
// 2026-08-31: needs_what/needs_why/needs_result/diaries_why/today_screen/author
// сняты с визарда (schema-miniapp/src/components/disclaimer/steps.ts) — визард
// дублировал онбординг трекера (OnboardingOverlay) и пустые состояния фичей;
// контент переехал туда же, третьей копии не завели. Список ЗДЕСЬ намеренно
// НЕ сокращён: он реконструирует воронку «докуда доходят» за прошлые 30 дней
// из уже накопленных в БД событий (bot.product-metrics.service.ts фильтрует
// по фактически встреченным строкам — на пустой БД/после ротации окна лишние
// шаги просто не появляются в отчёте, не роняя его). Новые события с этими
// шагами больше не приходят.
export const ONBOARDING_STEPS = [
  'welcome',
  'privacy',
  'not_therapy',
  'needs_what',
  'needs_why',
  'needs_result',
  'diaries_why',
  'today_screen',
  'author',
  'home_screen',
  'done',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
