import { useEffect, useRef } from 'react';
import { api } from '../api';
import {
  ONBOARDING_STEP_EVENT,
  type OnboardingStep,
} from '../../../shared/src/share/analytics';

/**
 * Шлёт `onboarding_step` при первом показе каждого шага (правило №8): в /stats
 * из этого собирается воронка «докуда доходят новички».
 *
 * Дедупликация обязательна: по точкам навигации и кнопке «Назад» на один и тот
 * же шаг возвращаются по нескольку раз, и без неё воронка показывала бы
 * количество пролистываний, а не количество людей.
 */
export function useOnboardingStepTracking(step: OnboardingStep): void {
  const sent = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (sent.current.has(step)) return;
    sent.current.add(step);
    api.trackEvent(ONBOARDING_STEP_EVENT, { step });
  }, [step]);
}

/** Финальная кнопка онбординга — отдельный шаг воронки 'done'. */
export function trackOnboardingDone(): void {
  api.trackEvent(ONBOARDING_STEP_EVENT, {
    step: 'done' satisfies OnboardingStep,
  });
}
