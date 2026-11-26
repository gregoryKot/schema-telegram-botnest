// @vitest-environment jsdom
// Флаг «дисклеймер терапевта показан»: пусто — не показан, после mark — показан.
import { describe, it, expect, beforeEach } from 'vitest';
import { markTherapistDisclaimerSeen, isTherapistDisclaimerSeen, THERAPIST_DISCLAIMER_KEY } from './therapistDisclaimerSeen';

beforeEach(() => localStorage.clear());

describe('therapistDisclaimerSeen', () => {
  it('пусто — false', () => {
    expect(isTherapistDisclaimerSeen()).toBe(false);
  });

  it('mark — true и ключ = 1', () => {
    markTherapistDisclaimerSeen();
    expect(isTherapistDisclaimerSeen()).toBe(true);
    expect(localStorage.getItem(THERAPIST_DISCLAIMER_KEY)).toBe('1');
  });
});
