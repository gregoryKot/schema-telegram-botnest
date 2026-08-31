// Порядок первого входа фиксируем тестом. Свод 2026-08-31 сократил визард до
// welcome/privacy/not_therapy/home_screen — содержательные шаги (потребности,
// дневники, экран «Сегодня», автор) переехали на путь пользователя (см.
// комментарий в steps.ts), и тест больше не проверяет их порядок здесь.
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_ORDER,
  CONSENT_STEP,
  buildSteps,
  canAdvance,
  initialStepIndex,
} from './steps';

describe('порядок шагов онбординга', () => {
  it('согласия идут подряд сразу после приветствия', () => {
    const i = (id: string) => ONBOARDING_ORDER.indexOf(id as never);
    expect(i('welcome')).toBe(0);
    expect(i('privacy')).toBe(i('welcome') + 1);
    expect(i('not_therapy')).toBe(i('privacy') + 1);
    expect(i('not_therapy')).toBe(i(CONSENT_STEP));
  });

  it('шесть содержательных шагов сняты — их больше нет в визарде', () => {
    for (const removed of [
      'needs_what',
      'needs_why',
      'needs_result',
      'diaries_why',
      'today_screen',
      'author',
    ]) {
      expect(ONBOARDING_ORDER).not.toContain(removed);
    }
  });

  it('шаг «значок на экран» есть только там, где он работает', () => {
    expect(buildSteps(true)).toContain('home_screen');
    expect(buildSteps(false)).not.toContain('home_screen');
    // остальные шаги не теряются
    expect(buildSteps(false)).toHaveLength(ONBOARDING_ORDER.length - 1);
  });

  it('гейт согласий держит только шаг с галочками', () => {
    expect(canAdvance('not_therapy', false)).toBe(false);
    expect(canAdvance('not_therapy', true)).toBe(true);
    expect(canAdvance('welcome', false)).toBe(true);
    expect(canAdvance('privacy', false)).toBe(true);
  });

  // Ничего не показывается дважды: согласие, данное в боте или на сайте,
  // не заставляет проходить юридические экраны заново.
  describe('согласие уже дано → открываемся на последнем содержательном шаге', () => {
    it('home_screen доступен → открываемся сразу на нём', () => {
      const steps = buildSteps(true);
      expect(steps[initialStepIndex(steps, true)]).toBe('home_screen');
    });

    it('home_screen недоступен (не Telegram/уже есть на экране) → открываемся на последнем доступном шаге', () => {
      const steps = buildSteps(false);
      expect(initialStepIndex(steps, true)).toBe(steps.length - 1);
      expect(steps[initialStepIndex(steps, true)]).toBe('not_therapy');
    });
  });

  it('новичок начинает с самого начала', () => {
    const steps = buildSteps(false);
    expect(initialStepIndex(steps, false)).toBe(0);
    expect(steps[0]).toBe('welcome');
  });
});
