import { describe, it, expect } from 'vitest';
import { buildWeeklyNote, weeklyAnswerMax } from './weeklyAnswerLimit';
import { getQuestion } from './weeklyQuestion.helpers';
import { DAY_NOTE_MAX } from '../../../shared/src/limits/textLimits';

describe('buildWeeklyNote', () => {
  it('заголовок с вопросом, пустая строка, ответ без пробелов по краям', () => {
    expect(buildWeeklyNote('Как дела?', '  хорошо \n')).toBe(
      '[Вопрос недели] Как дела?\n\nхорошо',
    );
  });
});

describe('weeklyAnswerMax', () => {
  it('предел ответа = предел заметки дня минус заголовок', () => {
    const q = 'Как дела?';
    expect(weeklyAnswerMax(q)).toBe(
      DAY_NOTE_MAX - buildWeeklyNote(q, '').length,
    );
  });

  it('ответ ровно в предел вместе с заголовком укладывается в заметку дня — для любого вопроса, в обеих формах', () => {
    // getQuestion берёт вопрос по номеру недели; перебираем обе формы обращения.
    for (const tr of [(ty: string) => ty, (_ty: string, vy: string) => vy]) {
      const q = getQuestion(tr);
      const note = buildWeeklyNote(q, 'я'.repeat(weeklyAnswerMax(q)));
      expect(note.length).toBe(DAY_NOTE_MAX);
    }
  });

  it('слишком длинный вопрос не даёт отрицательный предел', () => {
    expect(weeklyAnswerMax('в'.repeat(DAY_NOTE_MAX * 2))).toBe(0);
  });
});
