// Агрегат быстрых практик «Здесь и сейчас»: маппинг bigint→number, разбивка
// PracticeSession по tool (groupBy), заземление без «started» (нет события).
// Prisma мокается; порядок вызовов совпадает с Promise.all.
import { PracticeMetricsService } from './practice-metrics.service';

describe('PracticeMetricsService.getMetrics', () => {
  const build = (
    eventCounts: number[],
    sessionRows: Array<{ tool: string; _count: { _all: number } }>,
    usersRaw: Array<{ c: bigint }>,
  ) => {
    const count = jest.fn();
    eventCounts.forEach((v) => count.mockResolvedValueOnce(v));
    const groupBy = jest.fn().mockResolvedValueOnce(sessionRows);
    const queryRaw = jest.fn().mockResolvedValueOnce(usersRaw);
    const prisma = {
      analyticsEvent: { count },
      practiceSession: { groupBy },
      $queryRaw: queryRaw,
    } as never;
    return { service: new PracticeMetricsService(prisma) };
  };

  it('собирает «запускали» из событий и «прошли до конца» из PracticeSession', async () => {
    const { service } = build(
      [33, 21],
      [
        { tool: 'breathing', _count: { _all: 12 } },
        { tool: 'stop', _count: { _all: 9 } },
        { tool: 'grounding', _count: { _all: 8 } },
      ],
      [{ c: 14n }],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      breathing: { started: 33, completed: 12 },
      grounding: { completed: 8 },
      stop: { started: 21, completed: 9 },
      distinctUsers: 14,
    });
  });

  it('пустая БД даёт нули, а не NaN/undefined (grounding отсутствует в groupBy)', async () => {
    const { service } = build([0, 0], [], []);
    await expect(service.getMetrics()).resolves.toEqual({
      breathing: { started: 0, completed: 0 },
      grounding: { completed: 0 },
      stop: { started: 0, completed: 0 },
      distinctUsers: 0,
    });
  });
});
