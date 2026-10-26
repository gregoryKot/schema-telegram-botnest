import { describe, it, expect } from 'vitest';
import { STATUS_BADGE, templateHue } from './taskModel';

// Сам статус задания (taskStatus, orderTasks, taskMeta) — общий с мини-аппом,
// его тесты в shared/src/tasks/taskStatus.test.ts.
describe('STATUS_BADGE', () => {
  it('«не вышло» не выглядит как «скоро срок» или «просрочено»', () => {
    expect(STATUS_BADGE.failed).not.toBe(STATUS_BADGE.overdue);
    expect(STATUS_BADGE.done).toContain('--ok');
  });
});

describe('templateHue', () => {
  it('hue по типу', () => {
    expect(templateHue('Схема-карточка')).toBe(28);
    expect(templateHue('Дневник режима')).toBe(310);
    expect(templateHue('Письмо себе')).toBe(145);
    expect(templateHue('Безопасное место')).toBe(240);
  });
});
