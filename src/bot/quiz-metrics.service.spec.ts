// Агрегат мини-тестов: маппинг bigint→number, разбивка по meta.src и
// meta.quiz. Prisma мокается; порядок вызовов совпадает с Promise.all.
import { QuizMetricsService } from './quiz-metrics.service';

describe('QuizMetricsService.getMetrics', () => {
  const build = (countValues: number[], rawValues: unknown[]) => {
    const count = jest.fn();
    countValues.forEach((v) => count.mockResolvedValueOnce(v));
    const queryRaw = jest.fn();
    rawValues.forEach((v) => queryRaw.mockResolvedValueOnce(v));
    const prisma = {
      analyticsEvent: { count },
      $queryRaw: queryRaw,
    } as never;
    return { service: new QuizMetricsService(prisma), count, queryRaw };
  };

  it('собирает воронку и разбивки', async () => {
    const { service } = build(
      [200, 150],
      [
        [
          { src: 'bot', c: 90n },
          { src: 'web', c: 60n },
        ],
        [
          { quiz: 'drives', c: 80n },
          { quiz: null, c: 2n },
        ],
      ],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      started30: 200,
      completed30: 150,
      completedBot30: 90,
      completedWeb30: 60,
      byQuiz30: [
        { quiz: 'drives', count: 80 },
        { quiz: 'другое', count: 2 },
      ],
    });
  });

  it('пустая БД даёт нули, а не NaN/undefined', async () => {
    const { service } = build([0, 0], [[], []]);
    await expect(service.getMetrics()).resolves.toEqual({
      started30: 0,
      completed30: 0,
      completedBot30: 0,
      completedWeb30: 0,
      byQuiz30: [],
    });
  });
});
