// Тумблер «Итоги дня» в /settings бота (хвост волны 3, решение Р1: два
// тумблера, как на сайте). Связка «нажал → экран показал новое состояние»:
// хендлер пишет флаг, а экран /settings читает его через тот же summaryOn.
import { Logger } from '@nestjs/common';
import { TelegramSummaryToggleService } from './telegram.summary-toggle.service';
import { ERROR_RETRY } from './telegram.constants';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

function makeBotService(overrides: Record<string, unknown> = {}) {
  let settings: Record<string, unknown> = {
    notifyEnabled: true,
    notifyReminderEnabled: true,
    notifyLocalHour: 21,
    notifyTimezone: 'Europe/Moscow',
    notifyFrequency: 0,
    notifyQuietStart: 23,
    notifyQuietEnd: 7,
    notifyGamified: false,
    notifyPausedUntil: null,
    addressForm: 'ty',
    ...overrides,
  };
  return {
    getUserSettings: jest.fn(() => Promise.resolve(settings)),
    updateUserSettings: jest.fn((_u: bigint, patch: object) => {
      settings = { ...settings, ...patch };
      return Promise.resolve();
    }),
    _get: () => settings,
  };
}

function setup(botService: object) {
  const scheduleService = {
    rescheduleForUser: jest.fn().mockResolvedValue(undefined),
  };
  const accountService = {
    canonicalUserId: jest.fn(async (id: number) => BigInt(id)),
  };
  const fakeBot = makeFakeBot();
  new TelegramSummaryToggleService(
    fakeBot.bot,
    botService as never,
    accountService as never,
    scheduleService as never,
  ).onModuleInit();
  return { fakeBot, scheduleService };
}

const screen = (ctx: { editMessageText: jest.Mock }) => {
  const [text, keyboard] = ctx.editMessageText.mock.calls[0];
  return { text: text as string, keyboard: JSON.stringify(keyboard) };
};

describe('settings:toggle_summary — тумблер «Итоги дня» в боте', () => {
  it('включены (поле не задано, дефолт схемы) → выключает, экран показывает «выключены» и кнопку включения', async () => {
    const botService = makeBotService();
    const { fakeBot, scheduleService } = setup(botService);
    const ctx = await runAction(fakeBot, 'settings:toggle_summary');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {
      notifySummaryEnabled: false,
    });
    // стоящая сводка дня снимается там же, где после тумблера на сайте
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(1n);
    const { text, keyboard } = screen(ctx);
    expect(text).toContain('Итоги дня: выключены');
    expect(keyboard).toContain('📋 Включить итоги дня');
    expect(keyboard).toContain('settings:toggle_summary');
    expect(ctx.reply).not.toHaveBeenCalled(); // переход — editMessageText
  });

  it('выключены → включает; «Напоминания» не трогает', async () => {
    const botService = makeBotService({ notifySummaryEnabled: false });
    const { fakeBot } = setup(botService);
    const ctx = await runAction(fakeBot, 'settings:toggle_summary');
    expect(botService._get()).toMatchObject({
      notifySummaryEnabled: true,
      notifyEnabled: true,
      notifyReminderEnabled: true,
    });
    const { text, keyboard } = screen(ctx);
    expect(text).toContain('Итоги дня: включены');
    expect(text).toContain('Напоминания: 🔔 включены');
    expect(keyboard).toContain('📋 Выключить итоги дня');
  });

  it('без from — подтверждает нажатие, БД не трогает', async () => {
    const botService = makeBotService();
    const { fakeBot } = setup(botService);
    const ctx = await runAction(fakeBot, 'settings:toggle_summary', {
      from: undefined,
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    expect(botService.getUserSettings).not.toHaveBeenCalled();
    expect(botService._get().notifySummaryEnabled).toBeUndefined();
  });

  it('падение БД — сообщение об ошибке, не второй answerCbQuery', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { fakeBot } = setup({
      getUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
      updateUserSettings: jest.fn(),
    });
    const ctx = await runAction(fakeBot, 'settings:toggle_summary');
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.editMessageText).toHaveBeenLastCalledWith(
      ERROR_RETRY,
      expect.anything(),
    );
  });
});
