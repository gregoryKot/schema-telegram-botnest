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
      ]) // share_card by kind
      // скрытия блоков: новое событие + подмешанная история today_streak_toggle
      .mockResolvedValueOnce([
        { block: 'phrase', c: 4n },
        { block: 'streak', c: 7n },
      ])
      // воронка обучения приходит из БД в произвольном порядке
      .mockResolvedValueOnce([
        { step: 'done', c: 70n },
        { step: 'welcome', c: 100n },
        { step: 'needs_what', c: 80n },
      ])
      .mockResolvedValueOnce([
        { via: 'longpress', c: 12n },
        { via: 'gear', c: 30n },
      ])
      .mockResolvedValueOnce([
        { action: 'shown', c: 200n },
        { action: 'add', c: 60n },
        { action: 'added', c: 45n },
      ]);
    const eventCount = jest
      .fn()
      .mockResolvedValueOnce(12) // crisis_card_shown
      .mockResolvedValueOnce(3) // crisis_hotline_tapped
      .mockResolvedValueOnce(12) // share_card total7
      .mockResolvedValueOnce(40) // share_card total30
      .mockResolvedValueOnce(15) // today_focus_change
      .mockResolvedValueOnce(33) // breath_start
      .mockResolvedValueOnce(18); // journey_open

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

    // quizMetrics в getMetrics не участвует — нужен только для render().
    const quizMetrics = { getMetrics: jest.fn() } as never;
    const m = await new ProductMetricsService(prisma, quizMetrics).getMetrics();

    expect(m.onboarding).toEqual({ cohort30: 118, completed30: 70 });
    // блоки — в порядке листа настройки, не по убыванию счёта
    expect(m.today.blocksHidden).toEqual([
      { block: 'streak', count: 7 },
      { block: 'phrase', count: 4 },
    ]);
    expect(m.today.customizeGear).toBe(30);
    expect(m.today.customizeLongpress).toBe(12);
    // шаги пересортированы в порядок показа, счётчики bigint→number
    expect(m.onboardingSteps).toEqual([
      { step: 'welcome', count: 100 },
      { step: 'needs_what', count: 80 },
      { step: 'done', count: 70 },
    ]);
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
    expect(m.today.focusChanged).toBe(15);
    expect(m.breath).toEqual({ started: 33 });
    expect(m.journey).toEqual({ opens: 18 });
    // отсутствующие в выборке действия — нули, а не undefined/NaN
    expect(m.homeScreen).toEqual({
      shown: 200,
      add: 60,
      later: 0,
      never: 0,
      added: 45,
    });
  });

  it('render: блок мини-тестов подклеен к продуктовому отчёту', async () => {
    const quizMetrics = {
      getMetrics: jest.fn(async () => ({
        started30: 7,
        completed30: 5,
        completedBot30: 3,
        completedWeb30: 2,
        byQuiz30: [{ quiz: 'drives', count: 5 }],
      })),
    } as never;
    const service = new ProductMetricsService({} as never, quizMetrics);
    // Сами запросы к БД покрыты тестом выше — здесь проверяем склейку.
    jest.spyOn(service, 'getMetrics').mockResolvedValue(EMPTY_METRICS);

    const text = await service.render();
    expect(text).toContain('Мини-тесты без регистрации');
    expect(text).toContain('Начали: 7 · дошли до результата: 5');
    // Продуктовый блок тоже на месте (склейка ничего не потеряла).
    expect(text).toContain('Новички проходят обучение');
  });
});

// Минимальный валидный ProductMetrics для render-теста (пустая БД).
const EMPTY_METRICS = {
  onboarding: { cohort30: 0, completed30: 0 },
  onboardingSteps: [],
  adoption: {
    diaries: 0,
    ysqDone: 0,
    exercises: 0,
    practices: 0,
    childhood: 0,
  },
  ysq: { started: 0, completed: 0 },
  addressForm: { ty: 0, vy: 0, notChosen: 0 },
  sections: [],
  themes: { light: 0, dark: 0, system: 0 },
  shareCard: { total7: 0, total30: 0, byKind30: [] },
  crisis: { shown: 0, hotlineTapped: 0 },
  shareResult: { ok: 0, fallback: 0 },
  outbox: { flushes: 0, recovered: 0 },
  today: {
    focusChanged: 0,
    blocksHidden: [],
    customizeGear: 0,
    customizeLongpress: 0,
  },
  breath: { started: 0 },
  journey: { opens: 0 },
  homeScreen: { shown: 0, add: 0, later: 0, never: 0, added: 0 },
};
