import { describe, it, expect } from 'vitest';
import {
  buildTrackerOnboardingSteps,
  TRACKER_ORIGIN_NOTE,
} from './trackerOnboarding';

describe('trackerOnboarding', () => {
  it('три шага; заголовки различаются по форме обращения, тексты безличные', () => {
    const ty = buildTrackerOnboardingSteps((a) => a);
    const vy = buildTrackerOnboardingSteps((_a, b) => b);
    expect(ty).toHaveLength(3);
    expect(ty[0].title).toBe('Оценивай действия');
    expect(vy[0].title).toBe('Оценивайте действия');
    expect(ty[2].text).toBe(vy[2].text);
  });
  it('строка происхождения называет схема-терапию', () => {
    expect(TRACKER_ORIGIN_NOTE).toMatch(/схема-терапии/);
  });
});
