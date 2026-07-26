// Публичная выдача мини-тестов: контент из quiz-registry, форма из ?form,
// всё неизвестное — «ты» (дефолт проекта для анонимов).
import { QuizController } from './quiz.controller';

describe('QuizController', () => {
  const controller = new QuizController();

  it('отдаёт все тесты со структурой для сайта', () => {
    const { quizzes } = controller.list(undefined);
    expect(quizzes.map((q) => q.id)).toEqual(['drives', 'critic', 'battery']);
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
