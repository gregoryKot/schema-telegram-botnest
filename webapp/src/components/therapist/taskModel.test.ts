import { describe, it, expect } from 'vitest';
import { taskStatus, templateHue } from './taskModel';

describe('taskStatus', () => {
  const today = '2026-10-15';
  it('выполнено важнее срока', () => {
    expect(taskStatus({ done: true, dueDate: '2026-10-01' }, today)).toBe('done');
  });
  it('без срока — в работе', () => {
    expect(taskStatus({ done: false, dueDate: null }, today)).toBe('active');
  });
  it('срок через 2 дня и меньше — скоро, сегодня включительно', () => {
    expect(taskStatus({ done: null, dueDate: '2026-10-15' }, today)).toBe('soon');
    expect(taskStatus({ done: null, dueDate: '2026-10-17' }, today)).toBe('soon');
  });
  it('далеко — в работе, прошёл — просрочено', () => {
    expect(taskStatus({ done: null, dueDate: '2026-10-18' }, today)).toBe('active');
    expect(taskStatus({ done: null, dueDate: '2026-10-14' }, today)).toBe('overdue');
  });
});

describe('templateHue', () => {
  it('hue по типу', () => {
    expect(templateHue('Схема-карточка')).toBe(28);
    expect(templateHue('Дневник режима')).toBe(310);
    expect(templateHue('Письмо себе')).toBe(145);
    expect(templateHue('Imagery rescripting')).toBe(240);
  });
});
