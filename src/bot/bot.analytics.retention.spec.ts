// Тест когортного retention и воронки онбординга (аудит 2026-07, этап 4.6).
// SQL мокается — проверяем сборку структуры и форматирование блока /stats.
import {
  BotAnalyticsService,
  formatRetentionBlock,
  RetentionStats,
} from './bot.analytics.service';

describe('getRetentionStats', () => {
  it('собирает точки D1/D7/D30 и воронку из запросов', async () => {
    const rawResults = [
      [{ cohort: 10n, retained: 4n }], // D1
      [{ cohort: 8n, retained: 2n }], // D7
      [{ cohort: 5n, retained: 1n }], // D30
      [{ c: 6n }], // filledOnce30
    ];
    let rawCall = 0;
    const prisma: any = {
      $queryRaw: jest.fn(async () => rawResults[rawCall++]),
      user: {
        count: jest
          .fn()
          .mockResolvedValueOnce(20) // registered30
          .mockResolvedValueOnce(15), // consented30
      },
    };
    // Promise.all исполняет point(1/7/30) и filled в порядке объявления —
    // но $queryRaw вызывается конкурентно; порядок фиксируем очередью выше,
    // поэтому важно: точки и filled различимы по форме результата.
    const svc = new BotAnalyticsService(prisma);
    const s = await svc.getRetentionStats();
    expect(s.d1).toEqual({ cohort: 10, retained: 4 });
    expect(s.d7).toEqual({ cohort: 8, retained: 2 });
    expect(s.d30).toEqual({ cohort: 5, retained: 1 });
    expect(s.funnel).toEqual({
      registered30: 20,
      consented30: 15,
      filledOnce30: 6,
    });
  });
});

describe('formatRetentionBlock', () => {
  const stats: RetentionStats = {
    d1: { cohort: 10, retained: 4 },
    d7: { cohort: 8, retained: 2 },
    d30: { cohort: 0, retained: 0 },
    funnel: { registered30: 20, consented30: 15, filledOnce30: 6 },
  };

  it('проценты и абсолюты; пустая когорта — прочерк', () => {
    const text = formatRetentionBlock(stats);
    expect(text).toContain('D1: 40% (4/10)');
    expect(text).toContain('D7: 25% (2/8)');
    expect(text).toContain('D30: —');
    expect(text).toContain('Регистрация: 20');
    expect(text).toContain('Приняли согласие: 15 (75%)');
    expect(text).toContain('Заполнили трекер хоть раз: 6 (30%)');
  });

  it('нулевые регистрации не дают деления на ноль', () => {
    const empty = formatRetentionBlock({
      ...stats,
      funnel: { registered30: 0, consented30: 0, filledOnce30: 0 },
    });
    expect(empty).toContain('Регистрация: 0');
    expect(empty).not.toContain('NaN');
  });
});
