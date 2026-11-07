// TherapistExitMetricsService: что попадает в блок «Терапевты уходят».
// Строки без числа clientsEnded — подделка через POST /api/event (клиентский
// путь meta этого события не пропускает), в отчёт не идут.
import type { PrismaService } from '../prisma/prisma.service';
import { TherapistExitMetricsService } from './therapist-exit-metrics.service';

const DAY = 86_400_000;
const now = new Date('2026-10-22T12:00:00Z').getTime();
const ago = (days: number) => new Date(now - days * DAY);

function makeService(rows: object[]) {
  const findMany = jest.fn(() => Promise.resolve(rows));
  const service = new TherapistExitMetricsService({
    analyticsEvent: { findMany },
  } as unknown as PrismaService);
  return { service, findMany };
}

describe('TherapistExitMetricsService', () => {
  beforeAll(() => jest.useFakeTimers().setSystemTime(now));
  afterAll(() => jest.useRealTimers());

  it('пустая база → нули и текст без цифр', async () => {
    const { service } = makeService([]);
    expect(await service.getMetrics()).toEqual({
      window: { therapists: 0, clients: 0 },
      month: { therapists: 0, clients: 0 },
    });
    expect(await service.render()).toContain('никто не отказывался');
  });

  it('читает только событие отказа, с userId, за окно хранения', async () => {
    const { service, findMany } = makeService([]);
    await service.getMetrics();
    expect(findMany).toHaveBeenCalledWith({
      where: {
        name: 'therapist_resigned',
        userId: { not: null },
        createdAt: { gte: ago(90) },
      },
      select: { userId: true, meta: true, createdAt: true },
    });
  });

  it('терапевты — разные люди, клиенты — сумма; месяц — последние 30 дней', async () => {
    const { service } = makeService([
      { userId: 1n, meta: { clientsEnded: 3 }, createdAt: ago(2) },
      { userId: 1n, meta: { clientsEnded: 0 }, createdAt: ago(40) },
      { userId: 2n, meta: { clientsEnded: 5 }, createdAt: ago(60) },
    ]);
    expect(await service.getMetrics()).toEqual({
      window: { therapists: 2, clients: 8 },
      month: { therapists: 1, clients: 3 },
    });
  });

  it('строка без числа в meta (подделка с клиента) не считается', async () => {
    const { service } = makeService([
      { userId: 7n, meta: null, createdAt: ago(1) },
      { userId: 8n, meta: { clientsEnded: '9' }, createdAt: ago(1) },
      { userId: 9n, meta: { clientsEnded: -1 }, createdAt: ago(1) },
      { userId: 1n, meta: { clientsEnded: 2 }, createdAt: ago(1) },
    ]);
    expect(await service.getMetrics()).toEqual({
      window: { therapists: 1, clients: 2 },
      month: { therapists: 1, clients: 2 },
    });
  });
});
