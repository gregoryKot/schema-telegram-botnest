// TrackerController был на 0% покрытия. Инстанцируем напрямую с фейками
// сервисов (паттерн booking/payment.controller.spec.ts). Покрываем методы
// с реальной логикой (валидация даты, агрегация allDone/streak, экспорт,
// достижения+пара, детский опросник) — чистую делегацию (getNeeds, getStreak,
// recordActivity, getChildhoodRatings) не дублируем тестами.
import { BadRequestException } from '@nestjs/common';
import { TrackerController } from './tracker.controller';
import { NEED_IDS } from '../bot/bot.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

function makeController(overrides: Record<string, any> = {}) {
  const botService = {
    getNeeds: jest.fn(() => [
      {
        id: 'attachment',
        emoji: '🤝',
        title: 't',
        fullTitle: 'f',
        chartLabel: 'c',
      },
      {
        id: 'autonomy',
        emoji: '🚀',
        title: 't',
        fullTitle: 'f',
        chartLabel: 'c',
      },
      {
        id: 'expression',
        emoji: '💬',
        title: 't',
        fullTitle: 'f',
        chartLabel: 'c',
      },
      { id: 'play', emoji: '🎉', title: 't', fullTitle: 'f', chartLabel: 'c' },
      {
        id: 'limits',
        emoji: '⚖️',
        title: 't',
        fullTitle: 'f',
        chartLabel: 'c',
      },
    ]),
    getRatings: jest.fn(() => Promise.resolve({})),
    saveRating: jest.fn(() => Promise.resolve(undefined)),
    getNote: jest.fn(() => Promise.resolve({ text: '' })),
    saveNote: jest.fn(() => Promise.resolve(undefined)),
    getChildhoodRatings: jest.fn(() => Promise.resolve({})),
    saveChildhoodRatings: jest.fn(() => Promise.resolve(undefined)),
    ...overrides.botService,
  };
  const analyticsService = {
    getStreakData: jest.fn(() =>
      Promise.resolve({ currentStreak: 3, longestStreak: 5, totalDays: 10 }),
    ),
    getHistoryRatings: jest.fn(() => Promise.resolve([])),
    recordActivity: jest.fn(() => Promise.resolve({ ok: true })),
    getWeeklyStats: jest.fn(() => Promise.resolve([])),
    getBestDayOfWeek: jest.fn(() => Promise.resolve(null)),
    getWorstDayOfWeek: jest.fn(() => Promise.resolve(null)),
    getAchievements: jest.fn(() =>
      Promise.resolve([{ id: 'first_entry', earned: true }]),
    ),
    ...overrides.analyticsService,
  };
  const pairsService = {
    getUserPairs: jest.fn(() => Promise.resolve([])),
    ...overrides.pairsService,
  };
  const scheduleService = {
    onDiaryComplete: jest.fn(() => Promise.resolve(undefined)),
    ...overrides.scheduleService,
  };
  const tasksService = {
    checkStreakTasks: jest.fn(() => Promise.resolve(undefined)),
    ...overrides.tasksService,
  };
  const controller = new TrackerController(
    botService,
    analyticsService,
    pairsService,
    scheduleService,
    tasksService,
  );
  return {
    controller,
    botService,
    analyticsService,
    pairsService,
    scheduleService,
    tasksService,
  };
}

describe('TrackerController.getRatings', () => {
  it('невалидный формат даты → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.getRatings(makeReq(), '17-07-2026'),
    ).rejects.toThrow(BadRequestException);
  });

  it('валидная дата делегируется в сервис', async () => {
    const { controller, botService } = makeController();
    await controller.getRatings(makeReq(5n), '2026-07-17');
    expect(botService.getRatings).toHaveBeenCalledWith(5n, '2026-07-17');
  });

  it('без даты — тоже валидно (undefined)', async () => {
    const { controller, botService } = makeController();
    await controller.getRatings(makeReq());
    expect(botService.getRatings).toHaveBeenCalledWith(1n, undefined);
  });
});

describe('TrackerController.saveRating', () => {
  it('невалидная дата → BadRequestException, saveRating не вызывается', async () => {
    const { controller, botService } = makeController();
    await expect(
      controller.saveRating(makeReq(), {
        needId: 'attachment',
        value: 5,
        date: 'not-a-date',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(botService.saveRating).not.toHaveBeenCalled();
  });

  it('исторический бэкфилл (есть date) — не проверяет allDone, getRatings не дёргается повторно', async () => {
    const { controller, botService } = makeController();
    const res = await controller.saveRating(makeReq(), {
      needId: 'attachment',
      value: 7,
      date: '2026-07-01',
    });
    expect(res).toEqual({ ok: true, allDone: false });
    expect(botService.getRatings).not.toHaveBeenCalled();
  });

  it('checkStreakTasks запускается фоново; его падение не мешает ответу', async () => {
    const { controller, tasksService } = makeController({
      tasksService: {
        checkStreakTasks: jest.fn(() => Promise.reject(new Error('boom'))),
      },
    });
    const res = await controller.saveRating(makeReq(), {
      needId: 'attachment',
      value: 7,
    });
    expect(res.ok).toBe(true);
    expect(tasksService.checkStreakTasks).toHaveBeenCalled();
  });

  it('не все потребности оценены сегодня → allDone: false, streak/onDiaryComplete не трогаются', async () => {
    const { controller, analyticsService, scheduleService } = makeController({
      botService: {
        getRatings: jest.fn(() => Promise.resolve({ attachment: 5 })),
      },
    });
    const res = await controller.saveRating(makeReq(), {
      needId: 'attachment',
      value: 5,
    });
    expect(res).toEqual({ ok: true, allDone: false });
    expect(analyticsService.getStreakData).not.toHaveBeenCalled();
    expect(scheduleService.onDiaryComplete).not.toHaveBeenCalled();
  });

  it('все потребности оценены → allDone: true, приходит streak, дневник помечен завершённым', async () => {
    const allRated = Object.fromEntries(NEED_IDS.map((id) => [id, 7]));
    const { controller, scheduleService } = makeController({
      botService: { getRatings: jest.fn(() => Promise.resolve(allRated)) },
    });
    const res = await controller.saveRating(makeReq(), {
      needId: 'limits',
      value: 7,
    });
    expect(res.allDone).toBe(true);
    expect(res.streak).toEqual({
      currentStreak: 3,
      longestStreak: 5,
      totalDays: 10,
    });
    expect(scheduleService.onDiaryComplete).toHaveBeenCalledWith(1n);
  });

  it('getStreakData падает → streak: null, но allDone всё равно true (не блокирует ответ юзеру)', async () => {
    const allRated = Object.fromEntries(NEED_IDS.map((id) => [id, 7]));
    const { controller } = makeController({
      botService: { getRatings: jest.fn(() => Promise.resolve(allRated)) },
      analyticsService: {
        getStreakData: jest.fn(() => Promise.reject(new Error('db down'))),
      },
    });
    const res = await controller.saveRating(makeReq(), {
      needId: 'limits',
      value: 7,
    });
    expect(res.allDone).toBe(true);
    expect(res.streak).toBeNull();
  });

  it('onDiaryComplete падает → не бросает наружу, ответ всё равно уходит', async () => {
    const allRated = Object.fromEntries(NEED_IDS.map((id) => [id, 7]));
    const { controller } = makeController({
      botService: { getRatings: jest.fn(() => Promise.resolve(allRated)) },
      scheduleService: {
        onDiaryComplete: jest.fn(() =>
          Promise.reject(new Error('notify down')),
        ),
      },
    });
    await expect(
      controller.saveRating(makeReq(), { needId: 'limits', value: 7 }),
    ).resolves.toEqual(expect.objectContaining({ ok: true, allDone: true }));
  });
});

describe('TrackerController.getHistory', () => {
  it('без параметра days — дефолт 7', async () => {
    const { controller, analyticsService } = makeController();
    await controller.getHistory(makeReq());
    expect(analyticsService.getHistoryRatings).toHaveBeenCalledWith(1n, 7);
  });

  it('days зажимается сверху в 30', async () => {
    const { controller, analyticsService } = makeController();
    await controller.getHistory(makeReq(), '365');
    expect(analyticsService.getHistoryRatings).toHaveBeenCalledWith(1n, 30);
  });

  it('нечисловое days трактуется как дефолт (7)', async () => {
    const { controller, analyticsService } = makeController();
    await controller.getHistory(makeReq(), 'garbage');
    expect(analyticsService.getHistoryRatings).toHaveBeenCalledWith(1n, 7);
  });
});

describe('TrackerController.getExport', () => {
  it('форматирует историю и стрик в текстовый отчёт', async () => {
    const { controller } = makeController({
      analyticsService: {
        getHistoryRatings: jest.fn(() =>
          Promise.resolve([
            { date: '2026-07-17', ratings: { attachment: 8 } },
            { date: '2026-07-16', ratings: {} },
          ]),
        ),
        getStreakData: jest.fn(() =>
          Promise.resolve({ currentStreak: 2, longestStreak: 4, totalDays: 9 }),
        ),
      },
    });
    const res = await controller.getExport(makeReq());
    expect(res.text).toContain('2026-07-16'); // развёрнуто (старые сверху)
    expect(res.text).toContain('2026-07-17');
    expect(res.text).toContain('8/10');
    expect(res.text).toContain('–'); // непроставленная потребность
    expect(res.text).toContain('Серия: 2 дн. · Рекорд: 4 · Всего: 9');
  });
});

describe('TrackerController.getAchievements', () => {
  it('добавляет pair_connected: true, если есть активная пара', async () => {
    const { controller } = makeController({
      pairsService: {
        getUserPairs: jest.fn(() =>
          Promise.resolve([{ status: 'pending' }, { status: 'active' }]),
        ),
      },
    });
    const res = await controller.getAchievements(makeReq());
    expect(res).toContainEqual({ id: 'pair_connected', earned: true });
  });

  it('pair_connected: false без активной пары', async () => {
    const { controller } = makeController({
      pairsService: {
        getUserPairs: jest.fn(() => Promise.resolve([{ status: 'pending' }])),
      },
    });
    const res = await controller.getAchievements(makeReq());
    expect(res).toContainEqual({ id: 'pair_connected', earned: false });
  });
});

describe('TrackerController.getNote', () => {
  it('без даты → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.getNote(makeReq(), undefined as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('невалидный формат → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(controller.getNote(makeReq(), '17.07.2026')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('валидная дата делегируется в сервис', async () => {
    const { controller, botService } = makeController();
    await controller.getNote(makeReq(), '2026-07-17');
    expect(botService.getNote).toHaveBeenCalledWith(1n, '2026-07-17');
  });
});

describe('TrackerController.saveNote', () => {
  it('без даты → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.saveNote(makeReq(), { text: 'hi' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('text не строка → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.saveNote(makeReq(), {
        date: '2026-07-17',
        text: 123 as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('обрезает текст до 500 символов перед сохранением', async () => {
    const { controller, botService } = makeController();
    await controller.saveNote(makeReq(), {
      date: '2026-07-17',
      text: 'x'.repeat(600),
    });
    const savedText = botService.saveNote.mock.calls[0][2];
    expect(savedText.length).toBe(500);
  });
});

describe('TrackerController.saveChildhoodRatings', () => {
  it('пустое тело (ни одной валидной оценки) → BadRequestException', async () => {
    const { controller, botService } = makeController();
    await expect(
      controller.saveChildhoodRatings(makeReq(), {}),
    ).rejects.toThrow(BadRequestException);
    expect(botService.saveChildhoodRatings).not.toHaveBeenCalled();
  });

  it('отбрасывает дробные/вне диапазона/неизвестные ключи, сохраняет только валидные', async () => {
    const { controller, botService } = makeController();
    await controller.saveChildhoodRatings(makeReq(), {
      attachment: 7,
      autonomy: 3.5, // дробное — отбрасывается
      expression: -1, // вне диапазона — отбрасывается
      play: 11, // вне диапазона — отбрасывается
      unknown_need: 5, // не входит в NEED_IDS — отбрасывается
    });
    expect(botService.saveChildhoodRatings).toHaveBeenCalledWith(1n, {
      attachment: 7,
    });
  });

  it('граничные значения 0 и 10 допустимы', async () => {
    const { controller, botService } = makeController();
    await controller.saveChildhoodRatings(makeReq(), {
      attachment: 0,
      limits: 10,
    });
    expect(botService.saveChildhoodRatings).toHaveBeenCalledWith(1n, {
      attachment: 0,
      limits: 10,
    });
  });
});
