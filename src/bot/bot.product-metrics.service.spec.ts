// Тест агрегата продуктовых метрик: маппинг bigint→number, разбивка
// share_result по meta.ok (true/false), сортировка распределения экранов.
// Prisma мокается; порядок вызовов совпадает с Promise.all в getMetrics.
import { ProductMetricsService } from './bot.product-metrics.service';

describe('ProductMetricsService.getMetrics', () => {
  it('собирает метрики из запросов и правильно раскладывает', async () => {
    const userCount = jest
      .fn()
      .mockResolvedValueOnce(118) // cohort30
      .mockResolvedValueOnce(70) // completed30
      .mockResolvedValueOnce(900) // ty
      .mockResolvedValueOnce(250) // vy
      .mockResolvedValueOnce(90) // notChosen
      .mockResolvedValueOnce(400) // themeLight
      .mockResolvedValueOnce(700) // themeDark
      .mockResolvedValueOnce(140); // themeSystem
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ c: 320n }]) // diaries
      .mockResolvedValueOnce([{ c: 140n }]) // exercises
      .mockResolvedValueOnce([{ c: 90n }]) // practices
      .mockResolvedValueOnce([{ c: 60n }]) // childhood
      .mockResolvedValueOnce([
        { ok: 'true', c: 35n },
        { ok: 'false', c: 5n },
      ]) // share_result
      .mockResolvedValueOnce([{ flushes: 8n, recovered: 21n }]) // outbox
      .mockResolvedValueOnce([
        { kind: 'streak', c: 20n },
        { kind: 'schema', c: 3n },
      ]); // share_card by kind
    const eventCount = jest
      .fn()
      .mockResolvedValueOnce(12) // crisis_card_shown
      .mockResolvedValueOnce(3) // crisis_hotline_tapped
      .mockResolvedValueOnce(12) // share_card total7
      .mockResolvedValueOnce(40); // share_card total30

    const prisma: any = {
      user: {
        count: userCount,
        groupBy: jest.fn(async () => [
          { defaultSection: 'help', _count: { _all: 80 } },
          { defaultSection: 'today', _count: { _all: 300 } },
        ]),
      },
      ysqResult: { count: jest.fn(async () => 210) },
      ysqProgress: { count: jest.fn(async () => 260) },
      analyticsEvent: { count: eventCount },
      $queryRaw: queryRaw,
    };

    const m = await new ProductMetricsService(prisma).getMetrics();

    expect(m.onboarding).toEqual({ cohort30: 118, completed30: 70 });
    expect(m.adoption).toEqual({
      diaries: 320,
      ysqDone: 210,
      exercises: 140,
      practices: 90,
      childhood: 60,
    });
    expect(m.ysq).toEqual({ started: 260, completed: 210 });
    expect(m.addressForm).toEqual({ ty: 900, vy: 250, notChosen: 90 });
    // распределение экранов отсортировано по убыванию
    expect(m.sections).toEqual([
      { key: 'today', count: 300 },
      { key: 'help', count: 80 },
    ]);
    expect(m.themes).toEqual({ light: 400, dark: 700, system: 140 });
    expect(m.shareCard).toEqual({
      total7: 12,
      total30: 40,
      byKind30: [
        { kind: 'streak', count: 20 },
        { kind: 'schema', count: 3 },
      ],
    });
    expect(m.crisis).toEqual({ shown: 12, hotlineTapped: 3 });
    expect(m.shareResult).toEqual({ ok: 35, fallback: 5 });
    expect(m.outbox).toEqual({ flushes: 8, recovered: 21 });
  });
});
