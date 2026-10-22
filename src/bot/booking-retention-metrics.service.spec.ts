// Агрегат блока «Данные записей»: три запроса Prisma (count × 2 + findFirst)
// и пересчёт даты самой старой ждущей брони в «через сколько дней срок».
// Prisma мокается (образец — data-export-metrics.service.spec.ts).
import { BookingRetentionMetricsService } from './booking-retention-metrics.service';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const DAY = 86_400_000;

describe('BookingRetentionMetricsService.getMetrics', () => {
  const build = (opts: {
    anonymized?: number;
    waiting?: number;
    oldest?: Date | null;
  }) => {
    const count = jest.fn(async (args: { where: { anonymizedAt: unknown } }) =>
      args.where.anonymizedAt === null
        ? (opts.waiting ?? 0)
        : (opts.anonymized ?? 0),
    );
    const findFirst = jest.fn(async () =>
      opts.oldest ? { startsAt: opts.oldest } : null,
    );
    const prisma = { booking: { count, findFirst } } as never;
    return {
      service: new BookingRetentionMetricsService(prisma),
      count,
      findFirst,
    };
  };

  it('раскладывает счётчики: стёрто, ждут, срок — 12 месяцев', async () => {
    const { service } = build({
      anonymized: 5,
      waiting: 8,
      oldest: new Date('2025-11-08T12:00:00.000Z'),
    });
    await expect(service.getMetrics(NOW)).resolves.toEqual({
      monthsKept: 12,
      anonymized: 5,
      waiting: 8,
      // 2025-11-08 + 12 месяцев = 2026-11-08, от 2026-10-08 это 31 день.
      daysToNext: 31,
    });
  });

  it('считает по Prisma-запросам: стёртые — anonymizedAt not null, ждущие — null, самая старая — по возрастанию startsAt', async () => {
    const { service, count, findFirst } = build({});
    await service.getMetrics(NOW);
    expect(count).toHaveBeenCalledWith({
      where: { anonymizedAt: { not: null } },
    });
    expect(count).toHaveBeenCalledWith({ where: { anonymizedAt: null } });
    expect(findFirst).toHaveBeenCalledWith({
      where: { anonymizedAt: null },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true },
    });
  });

  it('пустая база — нули и daysToNext null, а не NaN/undefined', async () => {
    const { service } = build({});
    await expect(service.getMetrics(NOW)).resolves.toEqual({
      monthsKept: 12,
      anonymized: 0,
      waiting: 0,
      daysToNext: null,
    });
  });

  it('срок вышел минуту назад — 0, не -0', async () => {
    const dueMinuteAgo = new Date(NOW.getTime() - 60_000);
    // startsAt = срок − 12 месяцев
    const startsAt = new Date(dueMinuteAgo.getTime());
    startsAt.setUTCMonth(startsAt.getUTCMonth() - 12);
    const { service } = build({ waiting: 1, oldest: startsAt });
    const m = await service.getMetrics(NOW);
    expect(Object.is(m.daysToNext, 0)).toBe(true);
  });

  it('срок вышел три дня назад, а запись не стёрта — отрицательное число', async () => {
    const startsAt = new Date(NOW.getTime() - 3 * DAY - 3_600_000);
    startsAt.setUTCMonth(startsAt.getUTCMonth() - 12);
    const { service } = build({ waiting: 1, oldest: startsAt });
    const m = await service.getMetrics(NOW);
    expect(m.daysToNext).toBe(-3);
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build({
      anonymized: 5,
      waiting: 8,
      oldest: new Date('2025-11-08T12:00:00.000Z'),
    });
    await expect(service.render()).resolves.toContain(
      'Уже стёрто у 5 записей.',
    );
  });

  it('render() на пустой базе — внятный текст без цифр-нулей', async () => {
    const { service } = build({});
    const out = await service.render();
    expect(out).toContain('Записей пока нет, стирать нечего.');
    expect(out).not.toContain('NaN');
  });
});
