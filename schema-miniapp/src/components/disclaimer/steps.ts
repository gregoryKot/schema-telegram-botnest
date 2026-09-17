import type { OnboardingStep } from '../../../../shared/src/share/analytics';

// Шаги, которые визард реально показывает — подмножество полного
// OnboardingStep (тот список аналитики НЕ сокращён, см. комментарий в
// shared/src/share/analytics.ts). Узкий тип, а не полный OnboardingStep,
// нужен здесь, чтобы `content[stepId]` в Disclaimer.tsx проверялся
// компилятором: индексация полным union требовала бы веток для снятых шагов
// (needs_what и т.п.), которых в визарде больше нет.
export type DisclaimerStep = Extract<
  OnboardingStep,
  'welcome' | 'privacy' | 'not_therapy' | 'home_screen'
>;

// Порядок шагов первого входа — чистая логика, чтобы порядок и гейт согласия
// проверялись тестом, а не глазами.
//
// Свод 2026-08-31: визард дублировал онбординг трекера (needs_why/needs_result
// слово в слово повторяли шаги 1 и 3 OnboardingOverlay, только раньше — когда
// человек трекер ещё не открывал). Шесть шагов сняты: needs_what, needs_why,
// needs_result, diaries_why, today_screen, author. Их контент не потерян — он
// живёт на самом пути пользователя (needs_what — строка над OnboardingOverlay,
// needs_why/needs_result — уже были в OnboardingOverlay, diaries_why — пустое
// состояние дневников, today_screen — подсказка в TodayCustomizeSheet, author —
// AboutSection настроек). Визарду остаётся то, что нельзя узнать иначе:
// приветствие и два юридических согласия.
export const ONBOARDING_ORDER: DisclaimerStep[] = [
  'welcome',
  'privacy', // согласие: что происходит с записями
  'not_therapy', // согласие: приложение не заменяет терапию
  'home_screen', // только там, где нативный экран Telegram корректен
];

// Последний шаг с галочкой: дальше не пускаем, пока обе не поставлены.
export const CONSENT_STEP: DisclaimerStep = 'not_therapy';

export function buildSteps(canAddToHome: boolean): DisclaimerStep[] {
  return canAddToHome
    ? ONBOARDING_ORDER
    : ONBOARDING_ORDER.filter((s) => s !== 'home_screen');
}

/** Можно ли уйти с шага дальше (гейт согласий). */
export function canAdvance(step: DisclaimerStep, consentReady: boolean) {
  return step === CONSENT_STEP ? consentReady : true;
}

/**
 * Шаг, на который открывается онбординг. Если согласие уже дано раньше (бот,
 * сайт, другое устройство), юридические экраны пропускаем — человек уже их
 * принял. Содержательной части после согласий больше нет (см. свод выше),
 * поэтому открываемся на «добавить на экран», если он доступен, иначе —
 * на последнем доступном шаге (юридические экраны повторно не нужны).
 */
export function initialStepIndex(
  steps: DisclaimerStep[],
  consentGiven: boolean,
): number {
  if (!consentGiven) return 0;
  const i = steps.indexOf('home_screen');
  return i === -1 ? steps.length - 1 : i;
}
