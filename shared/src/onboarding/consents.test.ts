import { describe, it, expect } from 'vitest';
import {
  consentsReady,
  consentHint,
  CONSENT_ANALYTICS_STEPS,
} from './consents';

const trFor = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  form === 'ty' ? ty : vy;

describe('consents', () => {
  it('готово только при двух галочках', () => {
    expect(consentsReady(true, true)).toBe(true);
    expect(consentsReady(true, false)).toBe(false);
    expect(consentsReady(false, true)).toBe(false);
    expect(consentsReady(false, false)).toBe(false);
  });
  it('подсказка исчезает при готовности и различает формы', () => {
    expect(consentHint(true, true, trFor('ty'))).toBeNull();
    expect(consentHint(false, false, trFor('ty'))).toBe('Отметь оба согласия');
    expect(consentHint(false, false, trFor('vy'))).toBe(
      'Отметьте оба согласия',
    );
    expect(consentHint(true, false, trFor('vy'))).toMatch(/Отметьте/);
  });
  it('шаги аналитики — privacy и not_therapy', () => {
    expect(CONSENT_ANALYTICS_STEPS).toEqual(['privacy', 'not_therapy']);
  });
});
