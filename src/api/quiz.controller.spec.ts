// Публичная выдача мини-тестов: контент из quiz-registry, форма из ?form,
// всё неизвестное — «ты» (дефолт проекта для анонимов).
import { QuizController } from './quiz.controller';
import { QUIZ_IDS } from '../quiz/quiz-registry';

describe('QuizController', () => {
  const controller = new QuizController();

  it('отдаёт все тесты со структурой для сайта', () => {
    const { quizzes } = controller.list(undefined);
    // Сверка с реестром, а не со списком-копией: новый тест обязан доехать до
    // сайта целиком, но переписывать эту строку на каждый тест незачем.
    expect(quizzes.map((q) => q.id)).toEqual([...QUIZ_IDS]);
    for (const q of quizzes) {
      expect(q.questions.length).toBeGreaterThan(0);
      expect(q.results.length).toBeGreaterThan(0);
      expect(q.intro).not.toBe('');
    }
  });

  it('?form=vy отдаёт «вы»-контент, мусор в form падает в «ты»', () => {
    const vy = controller.list('vy');
    const ty = controller.list('ty');
    const junk = controller.list('hacker');
    expect(JSON.stringify(vy)).not.toBe(JSON.stringify(ty));
    expect(JSON.stringify(junk)).toBe(JSON.stringify(ty));
    const critic = vy.quizzes.find((q) => q.id === 'critic');
    expect(critic?.title).toContain('ваш');
  });
});
