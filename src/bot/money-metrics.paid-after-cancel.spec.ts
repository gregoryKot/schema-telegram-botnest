// «Оплатили уже отменённую запись» в блоке «Деньги» (правило №8, аудит
// 2026-10): форматтер, включая пустое состояние, и запрос count. Живой прогон
// всего /stats — test/raw-sql-live-stats.e2e-spec.ts (через MoneyMetricsService).
import { BookingStatus } from '@prisma/client';
import {
  countPaidAfterCancel,
  formatPaidAfterCancel,
} from './money-metrics.paid-after-cancel';

describe('formatPaidAfterCancel', () => {
  it('пустая база: строки нет вовсе — без «0» и NaN', () => {
    expect(formatPaidAfterCancel({ week: 0, allTime: 0 }, true)).toEqual([]);
  });

  it('деньги есть, по отменённым не платили: «ни разу», а не «0»', () => {
    const out = formatPaidAfterCancel({ week: 0, allTime: 0 }, false).join(
      '\n',
    );
    expect(out).toBe('Оплатили уже отменённую запись: ни разу.');
  });

  it('за неделю было: подсветка, число и что делать — простыми словами', () => {
    const out = formatPaidAfterCancel({ week: 2, allTime: 5 }, false).join(
      '\n',
    );
    expect(out).toContain(
      '⚠️ Оплатили уже отменённую запись за 7 дней: 2 раза (за всё время — 5 раз).',
    );
    expect(out).toContain('вернуть оплату или предложить новое время');
    expect(out).not.toMatch(/CANCELLED|paidAt|вебхук|NaN|undefined/);
  });

  it('за неделю не было, раньше было: без подсветки и без призыва', () => {
    const out = formatPaidAfterCancel({ week: 0, allTime: 1 }, false).join(
      '\n',
    );
    expect(out).toBe(
      'Оплатили уже отменённую запись: за 7 дней ни разу, за всё время — 1 раз.',
    );
  });
});

describe('countPaidAfterCancel', () => {
  it('считает только отменённые с оплатой: неделя — по дате оплаты, всё время — без окна', async () => {
    const count = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(4);
    const now = Date.parse('2026-11-06T12:00:00Z');

    const res = await countPaidAfterCancel(
      { booking: { count } } as never,
      now,
    );

    expect(res).toEqual({ week: 1, allTime: 4 });
    expect(count).toHaveBeenNthCalledWith(1, {
      where: {
        status: BookingStatus.CANCELLED,
        paidAt: { gte: new Date('2026-10-30T12:00:00Z') },
      },
    });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: { status: BookingStatus.CANCELLED, paidAt: { not: null } },
    });
  });
});
