// Поведенческие тесты суб-экранов /settings: частота напоминаний, тихие часы,
// форма обращения. Каждый action: answerCbQuery, пишет верное поле, редактирует
// сообщение (не reply — CLAUDE.md).
import { TelegramNotifySettingsService } from './telegram.notify-settings.service';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

function makeBotService(overrides: Record<string, any> = {}) {
  let settings: any = {
    notifyEnabled: true,
    notifyLocalHour: 21,
    notifyTimezone: 'Europe/Moscow',
    notifyFrequency: 1,
    notifyQuietStart: 23,
    notifyQuietEnd: 7,
    notifyGamified: false,
    notifyPausedUntil: null,
    addressForm: 'ty',
    ...overrides,
  };
  return {
    getUserSettings: jest.fn(() => Promise.resolve(settings)),
    updateUserSettings: jest.fn((_userId: bigint, patch: any) => {
      settings = { ...settings, ...patch };
      return Promise.resolve();
    }),
    _get: () => settings,
  };
}

function makeService(botService: any) {
  const accountService = {
    setAdaptiveLevel: jest.fn().mockResolvedValue(undefined),
  };
  const scheduleService = {
    rescheduleForUser: jest.fn().mockResolvedValue(undefined),
  };
  const fakeBot = makeFakeBot();
  const service = new TelegramNotifySettingsService(
    fakeBot.bot,
    botService,
    accountService as any,
    scheduleService as any,
  );
  return { service, fakeBot, accountService, scheduleService };
}

describe('TelegramNotifySettingsService — частота (settings:freq:N)', () => {
  it('пишет notifyFrequency, синхронизирует адаптивный уровень, перепланирует', async () => {
    const botService = makeBotService({ notifyFrequency: 1 });
    const { service, fakeBot, accountService, scheduleService } =
      makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:freq:2');
    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(botService._get().notifyFrequency).toBe(2);
    expect(accountService.setAdaptiveLevel).toHaveBeenCalledWith(1n, 2);
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(1n);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('settings:pick_freq — только показывает варианты, БД не трогает', async () => {
    const botService = makeBotService();
    const { service, fakeBot, accountService } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:pick_freq');
    expect(botService.updateUserSettings).not.toHaveBeenCalled();
    expect(accountService.setAdaptiveLevel).not.toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalled();
  });
});

describe('TelegramNotifySettingsService — тихие часы (settings:quiet:S:E)', () => {
  it('валидный пресет 22:00–08:00 сохраняется', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:quiet:22:8');
    expect(botService._get().notifyQuietStart).toBe(22);
    expect(botService._get().notifyQuietEnd).toBe(8);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('пресет "выключить" (0:0) — совпадает по значениям start===end', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    await runAction(fakeBot, 'settings:quiet:0:0');
    expect(botService._get().notifyQuietStart).toBe(0);
    expect(botService._get().notifyQuietEnd).toBe(0);
  });

  it('пара, отсутствующая в списке пресетов — отклоняется, БД не пишется', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    // regex допускает 1-2 цифры, но нет такого пресета в QUIET_PRESETS
    const ctx = await runAction(fakeBot, 'settings:quiet:5:5');
    expect(botService.updateUserSettings).not.toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
  });

  it('вне диапазона часов (>23) — отклоняется', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:quiet:99:5');
    expect(botService.updateUserSettings).not.toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
  });
});

describe('TelegramNotifySettingsService — форма обращения (settings:addr:ty|vy)', () => {
  it('settings:addr:vy пишет addressForm=vy и возвращается на главный экран', async () => {
    const botService = makeBotService({ addressForm: 'ty' });
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:addr:vy');
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {
      addressForm: 'vy',
    });
    expect(ctx.editMessageText).toHaveBeenCalled();
    const [text] = ctx.editMessageText.mock.calls[0];
    expect(text).toContain('на «вы»');
  });

  it('settings:addr:ty пишет addressForm=ty', async () => {
    const botService = makeBotService({ addressForm: 'vy' });
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    await runAction(fakeBot, 'settings:addr:ty');
    expect(botService._get().addressForm).toBe('ty');
  });
});
