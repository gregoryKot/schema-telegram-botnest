// Баг 2026-11-05: клиент получал в боте «Терапевт назначил задание:
// emotional_deprivation» вместо названия карточки.
import { taskNotificationTitle } from './task-title';

describe('taskNotificationTitle', () => {
  it('schema_intro → название схемы', () => {
    expect(taskNotificationTitle('schema_intro', 'emotional_deprivation')).toBe(
      'Карточка схемы: Эмоциональная депривация',
    );
  });
  it('mode_intro → название режима', () => {
    expect(taskNotificationTitle('mode_intro', 'vulnerable_child')).toBe(
      'Карточка режима: Уязвимый Ребёнок',
    );
  });
  it('неизвестный id → без названия', () => {
    expect(taskNotificationTitle('schema_intro', 'nope')).toBe(
      'Карточка схемы',
    );
    expect(taskNotificationTitle('mode_intro', 'nope')).toBe('Карточка режима');
    expect(taskNotificationTitle('schema_intro', 'toString')).toBe(
      'Карточка схемы',
    );
  });
  it('обычный текст остаётся как есть', () => {
    expect(taskNotificationTitle('custom', 'сделать практику')).toBe(
      'сделать практику',
    );
  });
  it('старый формат: id схемы/режима в custom-задании', () => {
    expect(taskNotificationTitle('custom', 'emotional_deprivation')).toBe(
      'Карточка схемы: Эмоциональная депривация',
    );
    expect(taskNotificationTitle('custom', 'lonely_child')).toBe(
      'Карточка режима: Одинокий Ребёнок',
    );
  });
});
