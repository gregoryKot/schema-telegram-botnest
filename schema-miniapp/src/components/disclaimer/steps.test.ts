// Порядок первого входа фиксируем тестом: правило CLAUDE.md требует, чтобы
// новичок узнал «что это и зачем» СРАЗУ после согласий, а не в конце. Раньше
// объяснение стояло вторым шагом (до согласий) и терялось.
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_ORDER,
  CONSENT_STEP,
  buildSteps,
  canAdvance,
  initialStepIndex,
} from './steps';

describe('порядок шагов онбординга', () => {
  it('содержательная часть идёт сразу после согласий', () => {
    const i = (id: string) => ONBOARDING_ORDER.indexOf(id as never);
    expect(i('privacy')).toBeLessThan(i('not_therapy'));
    // «что за потребности» — первый шаг после последнего согласия
    expect(i('needs_what')).toBe(i(CONSENT_STEP) + 1);
    // три коротких шага знакомства идут подряд
    expect(i('needs_why')).toBe(i('needs_what') + 1);
    expect(i('needs_result')).toBe(i('needs_why') + 1);
    // и только потом — экран «Сегодня», автор и значок на телефон
    expect(i('today_screen')).toBeGreaterThan(i('needs_result'));
    expect(i('author')).toBeGreaterThan(i('today_screen'));
    expect(i('home_screen')).toBeGreaterThan(i('author'));
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
    expect(canAdvance('needs_what', false)).toBe(true);
  });

  // Ничего не показывается дважды: согласие, данное в боте или на сайте,
  // не заставляет проходить юридические экраны заново.
  it('согласие уже дано → открываемся на содержательной части', () => {
    const steps = buildSteps(false);
    expect(steps[initialStepIndex(steps, true)]).toBe('needs_what');
  });

  it('новичок начинает с самого начала', () => {
    const steps = buildSteps(false);
    expect(initialStepIndex(steps, false)).toBe(0);
    expect(steps[0]).toBe('welcome');
  });
});
