// Шаги обучающего онбординга мини-аппа (meta.step для onboarding_step).
// Порядок = порядок показа: по нему строится воронка «докуда доходят».
// 'done' — нажал финальную кнопку. Парный список на фронте:
// shared/src/share/analytics.ts (при добавлении шага синхронь оба).
//
// Отдельным файлом — по тому же поводу, что SHARE_CARD_KINDS и CRISIS_SURFACES
// (правило №10: файл сверх потолка обязан таять, а не расти вместе со списком).
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
