// Тесты контента быстрых практик: билдер отдаёт непустой контент для каждого
// id, а формы «ты»/«вы» реально различаются там, где есть обращение
// (правило CLAUDE.md «ты/вы» — свежая вилка легко забывается или сводится
// к одной форме).
import { describe, it, expect } from 'vitest';
import {
  buildQuickPractice,
  QUICK_PRACTICE_IDS,
  type QuickPracticeStep,
} from './quickPractices';

const tyTr = (ty: string) => ty;
const vyTr = (_ty: string, vy: string) => vy;

function assertNonEmptyStep(step: QuickPracticeStep) {
  expect(step.emoji.length).toBeGreaterThan(0);
  expect(step.title.trim().length).toBeGreaterThan(0);
  expect(step.hint.trim().length).toBeGreaterThan(0);
}

describe('buildQuickPractice', () => {
  it.each(QUICK_PRACTICE_IDS)(
    '%s: непустые title/subtitle/steps/done',
    (id) => {
      const p = buildQuickPractice(id, tyTr);
      expect(p.id).toBe(id);
      expect(p.emoji.length).toBeGreaterThan(0);
      expect(p.title.trim().length).toBeGreaterThan(0);
      expect(p.subtitle.trim().length).toBeGreaterThan(0);
      expect(p.steps.length).toBeGreaterThan(0);
      p.steps.forEach(assertNonEmptyStep);
      assertNonEmptyStep(p.done);
    },
  );

  it.each(QUICK_PRACTICE_IDS)(
    '%s: subtitle нейтральный — одинаковый в форме «ты» и «вы»',
    (id) => {
      const ty = buildQuickPractice(id, tyTr);
      const vy = buildQuickPractice(id, vyTr);
      expect(ty.subtitle).toBe(vy.subtitle);
    },
  );

  it.each(QUICK_PRACTICE_IDS)(
    '%s: хотя бы один шаг реально звучит по-разному в «ты» и «вы»',
    (id) => {
      const ty = buildQuickPractice(id, tyTr);
      const vy = buildQuickPractice(id, vyTr);
      const anyStepDiffers = ty.steps.some(
        (step, i) => step.title !== vy.steps[i].title,
      );
      expect(anyStepDiffers).toBe(true);
    },
  );

  it('breathing: три шага — вдох, задержка, выдох', () => {
    const p = buildQuickPractice('breathing', tyTr);
    expect(p.steps).toHaveLength(3);
  });

  it('grounding: пять шагов — 5-4-3-2-1', () => {
    const p = buildQuickPractice('grounding', tyTr);
    expect(p.steps).toHaveLength(5);
  });

  it('stop: четыре шага — С-Т-О-П', () => {
    const p = buildQuickPractice('stop', tyTr);
    expect(p.steps).toHaveLength(4);
  });
});
