// @vitest-environment jsdom
// Воронка онбординга в /stats считает ЛЮДЕЙ на шаге. Если бы хук слал событие
// на каждый показ, возвраты кнопкой «Назад» и точками навигации раздували бы
// счёт — поэтому дедупликация под тестом.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const trackEvent = vi.fn();
vi.mock('../api', () => ({
  api: { trackEvent: (...a: unknown[]) => trackEvent(...a) },
}));

import {
  useOnboardingStepTracking,
  trackOnboardingDone,
} from './useOnboardingStepTracking';

beforeEach(() => trackEvent.mockClear());

describe('useOnboardingStepTracking', () => {
  it('шлёт событие при показе шага', () => {
    renderHook(() => useOnboardingStepTracking('needs_what'));
    expect(trackEvent).toHaveBeenCalledWith('onboarding_step', {
      step: 'needs_what',
    });
  });

  it('каждый шаг считается один раз, даже если к нему вернулись', () => {
    const { rerender } = renderHook(
      ({ step }) => useOnboardingStepTracking(step),
      { initialProps: { step: 'welcome' as const } },
    );
    rerender({ step: 'privacy' } as never);
    rerender({ step: 'welcome' } as never); // вернулись назад
    rerender({ step: 'privacy' } as never);
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('финальная кнопка отмечается отдельным шагом', () => {
    trackOnboardingDone();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_step', {
      step: 'done',
    });
  });
});
