import { describe, it, expect } from 'vitest';
import { STATUS_BADGE, STATUS_TAG, templateHue } from './taskModel';

// Сам статус задания (taskStatus, orderTasks, taskMeta) — общий с мини-аппом,
// его тесты в shared/src/tasks/taskStatus.test.ts.
describe('STATUS_BADGE', () => {
  it('«не вышло» не выглядит как «скоро срок» или «просрочено»', () => {
    expect(STATUS_BADGE.failed).not.toBe(STATUS_BADGE.overdue);
    expect(STATUS_BADGE.done).toContain('--ok');
  });
});

describe('STATUS_TAG', () => {
  it('открытые статусы различаются оттенком или жирностью; «Просрочено» заметнее «В работе»', () => {
    const open = (['active', 'soon', 'overdue'] as const).map(s => `${STATUS_TAG[s].hue}|${STATUS_TAG[s].strong}`);
    expect(new Set(open).size).toBe(3);
    expect(STATUS_TAG.overdue.strong).toBe(true);
    expect(STATUS_TAG.active.strong).toBe(false);
  });
  it('закрытые — как колонки доски: «Выполнено» шалфей, «Не вышло» персик', () => {
    expect(STATUS_TAG.done.hue).toBe(135);
    expect(STATUS_TAG.failed.hue).toBe(45);
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
