// Настройки уведомлений/профиля: дефолты на пустом аккаунте (правило
// CLAUDE.md «никаких хардкод-заглушек» — но тут дефолты честные, не выдают
// себя за сохранённые данные, это разрешённый нейтральный старт), whitelist
// полей на запись (лишние/чужого типа поля молча отбрасываются — не 500 и
// не «прошли как есть»), и побочные эффекты (reschedule/adaptive level)
// срабатывают только когда реально изменилось релевантное поле.
import { SettingsController } from './settings.controller';
import type { BotService } from '../bot/bot.service';
import type { AccountService } from '../bot/account.service';
import type { TelegramScheduleService } from '../telegram/telegram.schedule.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

function makeController(
  overrides: {
    botService?: Partial<BotService>;
    accountService?: Partial<AccountService>;
    scheduleService?: Partial<TelegramScheduleService>;
  } = {},
) {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue(null),
    updateUserSettings: jest.fn().mockResolvedValue(undefined),
    ...overrides.botService,
  } as unknown as BotService;
  const accountService = {
    setAdaptiveLevel: jest.fn().mockResolvedValue(undefined),
    ...overrides.accountService,
  } as unknown as AccountService;
  const scheduleService = {
    rescheduleForUser: jest.fn().mockResolvedValue(undefined),
    ...overrides.scheduleService,
  } as unknown as TelegramScheduleService;
  const controller = new SettingsController(
    botService,
    accountService,
    scheduleService,
  );
  return { controller, botService, accountService, scheduleService };
}

describe('SettingsController.getSettings', () => {
  it('на пустом аккаунте (null из БД) — честные дефолты, а не мусор', async () => {
    const { controller } = makeController();
    const res = await controller.getSettings(makeReq());
    expect(res).toEqual({
      notifyEnabled: true,
      notifyLocalHour: 21,
      notifyTimezone: 'Europe/Moscow',
      notifyReminderEnabled: true,
      notifyFrequency: 0,
      notifyQuietStart: 22,
      notifyQuietEnd: 8,
      notifyGamified: false,
      notifyPausedUntil: null,
      addressForm: null,
      pairCardDismissed: false,
      mySchemaIds: [],
      myModeIds: [],
      therapistShareCards: true,
      therapistShareProfile: true,
      uiPrefs: {},
    });
  });

  it('запрашивает настройки под userId из req', async () => {
    const { controller, botService } = makeController();
    await controller.getSettings(makeReq(7n));
    expect(botService.getUserSettings).toHaveBeenCalledWith(7n);
  });

  it('сериализует notifyPausedUntil в ISO, mySchemaIds не-массив → []', async () => {
    const { controller } = makeController({
      botService: {
        getUserSettings: jest.fn().mockResolvedValue({
          notifyPausedUntil: new Date('2026-08-01T00:00:00.000Z'),
          mySchemaIds: 'not-an-array',
        }),
      },
    });
    const res = await controller.getSettings(makeReq());
    expect(res.notifyPausedUntil).toBe('2026-08-01T00:00:00.000Z');
    expect(res.mySchemaIds).toEqual([]);
  });

  it('mySchemaIds/myModeIds уже массив → отдаются как есть', async () => {
    const { controller } = makeController({
      botService: {
        getUserSettings: jest.fn().mockResolvedValue({
          mySchemaIds: ['abandonment'],
          myModeIds: ['vulnerable_child', 'punitive_parent'],
        }),
      },
    });
    const res = await controller.getSettings(makeReq());
    expect(res.mySchemaIds).toEqual(['abandonment']);
    expect(res.myModeIds).toEqual(['vulnerable_child', 'punitive_parent']);
  });

  it('uiPrefs сохранённый — отдаётся как есть (прогоняется через sanitizeUiPrefs на чтение)', async () => {
    const { controller } = makeController({
      botService: {
        getUserSettings: jest.fn().mockResolvedValue({
          uiPrefs: { today_streak_hidden: '1' },
        }),
      },
    });
    const res = await controller.getSettings(makeReq());
    expect(res.uiPrefs).toEqual({ today_streak_hidden: '1' });
  });

  it('uiPrefs с мусором в БД (устаревший/битый ключ) — отфильтровывается на чтение', async () => {
    const { controller } = makeController({
      botService: {
        getUserSettings: jest.fn().mockResolvedValue({
          uiPrefs: { today_streak_hidden: '1', stale_key: 'x' },
        }),
      },
    });
    const res = await controller.getSettings(makeReq());
    expect(res.uiPrefs).toEqual({ today_streak_hidden: '1' });
  });
});

describe('SettingsController.updateSettings — whitelist полей', () => {
  it('игнорирует поля вне DTO/диапазона, сохраняет только валидные', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(2n), {
      notifyEnabled: true,
      notifyLocalHour: 99, // вне диапазона 0..23 — отброшено вручную-проверкой контроллера
    });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(2n, {
      notifyEnabled: true,
    });
  });

  it('невалидная таймзона (не из VALID_TIMEZONES) отбрасывается', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(), {
      notifyTimezone: 'Mars/Olympus',
    });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {});
  });

  it('addressForm принимает только «ty»/«vy», остальное отбрасывается', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(), {
      addressForm: 'hacker',
    });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {});

    await controller.updateSettings(makeReq(), { addressForm: 'vy' });
    expect(botService.updateUserSettings).toHaveBeenLastCalledWith(1n, {
      addressForm: 'vy',
    });
  });

  it('mySchemaIds/myModeIds: длинный массив (>200) или длинный id (>=100) отбрасывается целиком', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(), {
      mySchemaIds: Array.from({ length: 201 }, (_, i) => `s${i}`),
    });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {});

    await controller.updateSettings(makeReq(), {
      myModeIds: ['ok', 'x'.repeat(100)],
    });
    expect(botService.updateUserSettings).toHaveBeenLastCalledWith(1n, {});
  });
});

describe('SettingsController.updateSettings — uiPrefs (серверное зеркало настроек мини-аппа)', () => {
  it('валидный набор ключей сохраняется целиком', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(11n), {
      uiPrefs: {
        today_streak_hidden: '1',
        today_focus_practice: 'tracker',
      },
    });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(11n, {
      uiPrefs: { today_streak_hidden: '1', today_focus_practice: 'tracker' },
    });
  });

  it('невалидное значение внутри uiPrefs отбрасывает только свой ключ (per-key), сохраняет остальное', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(12n), {
      uiPrefs: { today_streak_hidden: '1', today_focus_practice: 'garbage' },
    });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(12n, {
      uiPrefs: { today_streak_hidden: '1' },
    });
  });

  it('пустой объект uiPrefs — валидная «очистка всех ключей», сохраняется как {}', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(13n), { uiPrefs: {} });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(13n, {
      uiPrefs: {},
    });
  });

  it('поле uiPrefs отсутствует в теле — сохранённые настройки не трогаются', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(14n), { addressForm: 'vy' });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(14n, {
      addressForm: 'vy',
    });
  });
});

describe('SettingsController.updateSettings — валидные поля проходят whitelist', () => {
  it('все допустимые поля сохраняются одним вызовом', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(10n), {
      notifyReminderEnabled: false,
      notifyGamified: true,
      notifyTimezone: 'Europe/Moscow',
      notifyQuietStart: 23,
      notifyQuietEnd: 7,
      mySchemaIds: ['abandonment', 'defectiveness'],
      myModeIds: ['vulnerable_child'],
      therapistShareCards: false,
      therapistShareProfile: false,
    });
    expect(botService.updateUserSettings).toHaveBeenCalledWith(10n, {
      notifyReminderEnabled: false,
      notifyGamified: true,
      notifyTimezone: 'Europe/Moscow',
      notifyQuietStart: 23,
      notifyQuietEnd: 7,
      mySchemaIds: ['abandonment', 'defectiveness'],
      myModeIds: ['vulnerable_child'],
      therapistShareCards: false,
      therapistShareProfile: false,
    });
  });
});

describe('SettingsController.updateSettings — userId', () => {
  it('обновляет настройки под userId из req, а не из тела запроса', async () => {
    const { controller, botService } = makeController();
    await controller.updateSettings(makeReq(5n), {
      notifyEnabled: true,
      userId: 999,
    } as any);
    expect(botService.updateUserSettings).toHaveBeenCalledWith(5n, {
      notifyEnabled: true,
    });
  });
});

describe('SettingsController.updateSettings — побочные эффекты', () => {
  it('смена notifyFrequency сбрасывает адаптацию под userId из req', async () => {
    const { controller, accountService } = makeController();
    await controller.updateSettings(makeReq(6n), {
      notifyFrequency: 2,
    });
    expect(accountService.setAdaptiveLevel).toHaveBeenCalledWith(6n, 2);
  });

  it('без notifyFrequency — адаптация не трогается', async () => {
    const { controller, accountService, botService } = makeController();
    await controller.updateSettings(makeReq(7n), {
      pairCardDismissed: true,
    });
    // Настройка сохранена — но уровень адаптации остался прежним: побочный
    // эффект привязан к своему полю, а не к любому сохранению.
    expect(botService.updateUserSettings).toHaveBeenCalledWith(7n, {
      pairCardDismissed: true,
    });
    expect(accountService.setAdaptiveLevel).not.toHaveBeenCalled();
  });

  it('изменение времени/включения уведомлений перепланирует напоминание', async () => {
    const { controller, scheduleService } = makeController();
    await controller.updateSettings(makeReq(3n), {
      notifyLocalHour: 10,
    });
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(3n);
  });

  it('изменение поля вне списка триггеров (pairCardDismissed) не перепланирует', async () => {
    const { controller, scheduleService, botService } = makeController();
    await controller.updateSettings(makeReq(9n), {
      pairCardDismissed: true,
    });
    // Сохранение произошло, а пересчёт расписания — нет: лишний reschedule
    // сдвигает уже назначенное напоминание, поэтому важно, что он привязан
    // именно к полям времени/включения.
    expect(botService.updateUserSettings).toHaveBeenCalledWith(9n, {
      pairCardDismissed: true,
    });
    expect(scheduleService.rescheduleForUser).not.toHaveBeenCalled();
  });

  it('сброс паузы (notifyPausedUntil: null) тоже перепланирует', async () => {
    const { controller, scheduleService } = makeController();
    await controller.updateSettings(makeReq(8n), {
      notifyPausedUntil: null,
    });
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(8n);
  });

  it('возвращает { ok: true }', async () => {
    const { controller } = makeController();
    await expect(controller.updateSettings(makeReq(), {})).resolves.toEqual({
      ok: true,
    });
  });
});
