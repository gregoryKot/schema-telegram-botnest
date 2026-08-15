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
      .mockResolvedValueOnce(18) // journey_open
      .mockResolvedValueOnce(44); // ysq_help_open

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

    // quizMetrics/practiceLink/practiceMetrics в getMetrics не участвуют — нужны для render().
    const quizMetrics = { getMetrics: jest.fn() } as never;
    const practiceLink = { getMetrics: jest.fn() } as never;
    const practiceMetrics = { getMetrics: jest.fn() } as never;
    const m = await new ProductMetricsService(
      prisma,
      quizMetrics,
      practiceLink,
      practiceMetrics,
    ).getMetrics();

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
    expect(m.ysq).toEqual({ started: 260, completed: 210, helpOpens: 44 });
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

  // Пустая БД: каждый фолбэк (`rows[0]?.c ?? 0`, `find(...) ?? 0n`) обязан
  // отдать ноль, а не NaN/undefined — иначе /stats на чистой базе покажет мусор.
  it('пустая БД — везде нули, ни одного NaN/undefined', async () => {
    const prisma: any = {
      user: { count: jest.fn(async () => 0), groupBy: jest.fn(async () => []) },
      ysqResult: { count: jest.fn(async () => 0) },
      ysqProgress: { count: jest.fn(async () => 0) },
      analyticsEvent: { count: jest.fn(async () => 0) },
      $queryRaw: jest.fn(async () => []),
    };
    const m = await new ProductMetricsService(
      prisma,
      { getMetrics: jest.fn() } as never,
      { getMetrics: jest.fn() } as never,
      { getMetrics: jest.fn() } as never,
    ).getMetrics();

    expect(m.adoption).toEqual({
      diaries: 0,
      ysqDone: 0,
      exercises: 0,
      practices: 0,
      childhood: 0,
    });
    expect(m.sections).toEqual([]);
    expect(m.onboardingSteps).toEqual([]);
    expect(m.shareCard.byKind30).toEqual([]);
    expect(m.shareResult).toEqual({ ok: 0, fallback: 0 });
    expect(m.outbox).toEqual({ flushes: 0, recovered: 0 });
    expect(m.today).toEqual({
      focusChanged: 0,
      blocksHidden: [],
      customizeGear: 0,
      customizeLongpress: 0,
    });
    expect(m.homeScreen).toEqual({
      shown: 0,
      add: 0,
      later: 0,
      never: 0,
      added: 0,
    });
  });

  // Битые строки событий (meta без ключа → null из БД) не должны ронять отчёт:
  // безымянный kind подписывается «другое», строки без block/step отбрасываются.
  it('null в meta — безопасные подписи, а не строка «null»', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ c: 1n }]) // diaries
      .mockResolvedValueOnce([{ c: 1n }]) // exercises
      .mockResolvedValueOnce([{ c: 1n }]) // practices
      .mockResolvedValueOnce([{ c: 1n }]) // childhood
      .mockResolvedValueOnce([{ ok: null, c: 3n }]) // share_result без ok
      .mockResolvedValueOnce([{ flushes: 1n, recovered: 2n }]) // outbox
      .mockResolvedValueOnce([{ kind: null, c: 2n }]) // share_card без kind
      .mockResolvedValueOnce([{ block: null, c: 1n }]) // toggle без block
      .mockResolvedValueOnce([{ step: null, c: 5n }]) // онбординг без step
      .mockResolvedValueOnce([{ via: null, c: 4n }]) // customize без via
      .mockResolvedValueOnce([{ action: null, c: 6n }]); // offer без action
    const prisma: any = {
      user: {
        count: jest.fn(async () => 0),
        groupBy: jest.fn(async () => [
          { defaultSection: null, _count: { _all: 4 } },
        ]),
      },
      ysqResult: { count: jest.fn(async () => 0) },
      ysqProgress: { count: jest.fn(async () => 0) },
      analyticsEvent: { count: jest.fn(async () => 0) },
      $queryRaw: queryRaw,
    };
    const m = await new ProductMetricsService(
      prisma,
      { getMetrics: jest.fn() } as never,
      { getMetrics: jest.fn() } as never,
      { getMetrics: jest.fn() } as never,
    ).getMetrics();

    expect(m.shareCard.byKind30).toEqual([{ kind: 'другое', count: 2 }]);
    expect(m.sections).toEqual([{ key: 'другое', count: 4 }]);
    // ok=null — это ни успех, ни фолбэк: обе цифры нули.
    expect(m.shareResult).toEqual({ ok: 0, fallback: 0 });
    // Строки без block/step/via/action не превращаются в фантомные категории.
    expect(m.today.blocksHidden).toEqual([]);
    expect(m.onboardingSteps).toEqual([]);
    expect(m.today.customizeGear).toBe(0);
    expect(m.today.customizeLongpress).toBe(0);
    expect(m.homeScreen).toEqual({
      shown: 0,
      add: 0,
      later: 0,
      never: 0,
      added: 0,
    });
  });

  it('render: блоки мини-тестов и переходов к автору подклеены к отчёту', async () => {
    const quizMetrics = {
      getMetrics: jest.fn(async () => ({
        started30: 7,
        completed30: 5,
        completedBot30: 3,
        completedWeb30: 2,
        byQuiz30: [{ quiz: 'drives', count: 5 }],
      })),
    } as never;
    const practiceLink = {
      getMetrics: jest.fn(async () => ({
        total30: 3,
        author30: 2,
        footer30: 1,
        faq30: 0,
        quiz30: 0,
      })),
    } as never;
    const practiceMetrics = {
      getMetrics: jest.fn(async () => ({
        breathing: { started: 0, completed: 0 },
        grounding: { completed: 0 },
        stop: { started: 0, completed: 0 },
        distinctUsers: 0,
      })),
    } as never;
    const service = new ProductMetricsService(
      {} as never,
      quizMetrics,
      practiceLink,
      practiceMetrics,
    );
    // Сами запросы к БД покрыты тестом выше — здесь проверяем склейку.
    jest.spyOn(service, 'getMetrics').mockResolvedValue(EMPTY_METRICS);

    const text = await service.render();
    expect(text).toContain('Мини-тесты без регистрации');
    expect(text).toContain('Начали: 7 · дошли до результата: 5');
    expect(text).toContain('Переходы к автору-терапевту');
    expect(text).toContain('Переходили на сайт практики: 3');
    // Продуктовый блок тоже на месте (склейка ничего не потеряла).
    expect(text).toContain('Новички проходят обучение');
    // Блок быстрых практик тоже подклеен.
    expect(text).toContain('Быстрые практики «Здесь и сейчас»');
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
  ysq: { started: 0, completed: 0, helpOpens: 0 },
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
  journey: { opens: 0 },
  homeScreen: { shown: 0, add: 0, later: 0, never: 0, added: 0 },
};
