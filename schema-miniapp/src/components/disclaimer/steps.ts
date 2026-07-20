import type { OnboardingStep } from '../../../../shared/src/share/analytics';

// Порядок шагов первого входа — чистая логика, чтобы порядок и гейт согласия
// проверялись тестом, а не глазами.
//
// Главное правило порядка (CLAUDE.md, «Онбординг и очевидность»): сразу после
// принятия условий новичок узнаёт, что за пять потребностей, зачем их отмечать
// и что он увидит через 3–5 дней. Раньше этот блок стоял ДО согласий, и до
// объяснения человек добирался, уже пролистав юридические экраны.
export const ONBOARDING_ORDER: OnboardingStep[] = [
  'welcome',
  'privacy', // согласие: что происходит с записями
  'not_therapy', // согласие: приложение не заменяет терапию
  'needs_what', // ← отсюда содержательная часть, сразу после согласий
  'needs_why',
  'needs_result',
  'today_screen',
  'author',
  'home_screen', // только там, где нативный экран Telegram корректен
];

// Последний шаг с галочкой: дальше не пускаем, пока обе не поставлены.
export const CONSENT_STEP: OnboardingStep = 'not_therapy';

export function buildSteps(canAddToHome: boolean): OnboardingStep[] {
  return canAddToHome
    ? ONBOARDING_ORDER
    : ONBOARDING_ORDER.filter((s) => s !== 'home_screen');
}

/** Можно ли уйти с шага дальше (гейт согласий). */
export function canAdvance(step: OnboardingStep, consentReady: boolean) {
  return step === CONSENT_STEP ? consentReady : true;
}

/**
 * Шаг, на который открывается онбординг. Если согласие уже дано раньше (бот,
 * сайт, другое устройство), юридические экраны пропускаем — человек уже их
 * принял, а показать надо содержательную часть.
 */
export function initialStepIndex(
  steps: OnboardingStep[],
  consentGiven: boolean,
): number {
  if (!consentGiven) return 0;
  const i = steps.indexOf('needs_what');
  return i === -1 ? 0 : i;
}
