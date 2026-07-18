export const PRACTICES_ONBOARDING_KEY = 'practices_onboarding_done';

export function shouldShowPracticesOnboarding(): boolean {
  return !localStorage.getItem(PRACTICES_ONBOARDING_KEY);
}
