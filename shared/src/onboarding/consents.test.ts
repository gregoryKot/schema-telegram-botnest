import { describe, it, expect } from 'vitest';
import {
  consentsReady,
  consentHint,
  CONSENT_ANALYTICS_STEPS,
  welcomeTexts,
} from './consents';
import { hasTyForms } from '../utils/tyFormsSweep';

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
  it('шаги аналитики — welcome, privacy и not_therapy', () => {
    expect(CONSENT_ANALYTICS_STEPS).toEqual([
      'welcome',
      'privacy',
      'not_therapy',
    ]);
  });
  it('приветствие различает формы и не оставляет «ты» в форме «вы»', () => {
    const ty = welcomeTexts(trFor('ty'));
    const vy = welcomeTexts(trFor('vy'));
    expect(ty.greeting).toMatch(/Хорошо, что ты здесь/);
    expect(vy.greeting).toMatch(/Хорошо, что вы здесь/);
    expect(vy.outro).toMatch(/Если чувствуете/);
    expect(hasTyForms([vy.greeting, vy.intro, vy.outro].join(' '))).toBe(false);
    expect(ty.intro).toBe(vy.intro);
    expect(ty.beta).toBe('БЕТА-ВЕРСИЯ');
  });
});
