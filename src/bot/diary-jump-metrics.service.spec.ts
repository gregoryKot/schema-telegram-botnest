import { DiaryJumpMetricsService } from './diary-jump-metrics.service';

describe('DiaryJumpMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce(rows),
    } as never;
    return new DiaryJumpMetricsService(prisma);
  };

  it('раскладывает переходы по назначению', async () => {
    const s = build([
      { to: 'pattern', c: 4n },
      { to: 'case', c: 2n },
    ]);
    await expect(s.getMetrics()).resolves.toEqual({
      pattern30: 4,
      tracker30: 0,
      case30: 2,
    });
  });

  it('нет строк — нули', async () => {
    await expect(build([]).getMetrics()).resolves.toEqual({
      pattern30: 0,
      tracker30: 0,
      case30: 0,
    });
  });
});
