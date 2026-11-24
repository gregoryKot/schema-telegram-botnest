import { describe, expect, it } from 'vitest';
import { PLAN_RUBRICS } from './planItem';
import { guessPlanRubric } from './planRubricGuess';

describe('guessPlanRubric — рубрика плана по смыслу пункта «Что делать»', () => {
  it.each([
    [
      'Рескриптинг сцен травли: гнев на тех, кто не принимал [Янг, гл. 7].',
      'experiential',
    ],
    [
      'Стулья: Критику дают отдельный стул, терапевт спорит с ним.',
      'experiential',
    ],
    [
      'В жизни: сообщество по интересу и правило «прийти хотя бы три раза».',
      'behavioral',
    ],
    ['Лестница самостоятельных дел от лёгкого к трудному.', 'behavioral'],
    ['Проверять «мне нигде нет места» на конкретных случаях.', 'cognitive'],
    [
      'Когнитивно — собрать реалистичный образ себя: сильные стороны.',
      'cognitive',
    ],
    ['Эмпатическая конфронтация — сразу и от первого лица.', 'relationship'],
  ] as const)('%s → %s', (text, rubric) => {
    expect(guessPlanRubric(text)).toBe(rubric);
  });

  it('решает слово, стоящее раньше: действие пункта — в первой фразе', () => {
    expect(
      guessPlanRubric('В жизни: мелкие отказы. Потом рескриптинг сцены.'),
    ).toBe('behavioral');
  });

  it('ничего не узнал — «На сессии»; ответ всегда рубрика плана', () => {
    expect(
      guessPlanRubric('Групповая схема-терапия с постоянным составом.'),
    ).toBe('session');
    expect(PLAN_RUBRICS).toContain(guessPlanRubric(''));
  });
});
