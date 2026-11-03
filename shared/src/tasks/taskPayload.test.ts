// Текст задания, который уходит в БД. Регрессия QA 2026-10-26: «Отмечать
// потребности 3 дней подряд».
import { describe, it, expect } from 'vitest';
import { taskPayloadText } from './taskPayload';

const base = { targetDays: 7, schemaId: '', modeId: '', text: '' };

describe('taskPayloadText', () => {
  it('серия склоняет дни: 3 дня, 7 дней, 21 день', () => {
    expect(
      taskPayloadText({ ...base, type: 'tracker_streak', targetDays: 3 }),
    ).toBe('Отмечать потребности 3 дня подряд');
    expect(
      taskPayloadText({ ...base, type: 'diary_streak', targetDays: 7 }),
    ).toBe('Заполнять дневник 7 дней подряд');
    expect(
      taskPayloadText({ ...base, type: 'diary_streak', targetDays: 21 }),
    ).toBe('Заполнять дневник 21 день подряд');
  });

  it('карточки хранят id, упражнения — своё название, своё задание — текст', () => {
    expect(
      taskPayloadText({
        ...base,
        type: 'schema_intro',
        schemaId: 'abandonment',
      }),
    ).toBe('abandonment');
    expect(
      taskPayloadText({
        ...base,
        type: 'mode_intro',
        modeId: 'vulnerable_child',
      }),
    ).toBe('vulnerable_child');
    expect(taskPayloadText({ ...base, type: 'flashcard' })).toBe(
      'Разобрать сложную ситуацию по шагам',
    );
    expect(
      taskPayloadText({ ...base, type: 'custom', text: 'Позвонить другу' }),
    ).toBe('Позвонить другу');
  });
});
