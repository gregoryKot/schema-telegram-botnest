// Мини-тесты в боте: список → интро → кнопка в приложение. Ответов и
// результата в чате нет; проверяем и старые кнопки вопросов.
import { Logger } from '@nestjs/common';
import { TelegramQuizService } from './telegram.quiz.service';
import { APP_URL, ERROR_RETRY } from './telegram.constants';
import {
  makeFakeBot,
  runAction,
  runCommand,
  type FakeBot,
} from './telegram.test-helpers.spec';

const flat = (ctx: any, call = 0): string => {
  const args = (ctx.editMessageText as jest.Mock).mock.calls[call];
  return String(args?.[0] ?? '');
};

const keyboardData = (ctx: any): string[] => {
  const args = (ctx.editMessageText as jest.Mock).mock.calls[0];
  const rows = args?.[1]?.reply_markup?.inline_keyboard ?? [];
  return rows.flat().map((b: any) => b.callback_data ?? b.web_app?.url ?? '');
};

describe('TelegramQuizService', () => {
  let fakeBot: FakeBot;
  let botService: { getUserSettings: jest.Mock };

  const boot = (addressForm: string | null = null) => {
    fakeBot = makeFakeBot();
    botService = {
      getUserSettings: jest
        .fn()
        .mockResolvedValue(addressForm === null ? null : { addressForm }),
    };
    const service = new TelegramQuizService(
      fakeBot.bot,
      botService as any,
      { canonicalUserId: jest.fn(async (id: number) => BigInt(id)) } as any,
    );
    service.onModuleInit();
    return service;
  };

  it('/tests показывает список с кнопкой на каждый тест', async () => {
    boot();
    const ctx = await runCommand(fakeBot, 'tests');
    const [text, extra] = (ctx.reply as jest.Mock).mock.calls[0];
    expect(text).toContain('Мини-тесты');
    const data = extra.reply_markup.inline_keyboard
      .flat()
      .map((b: any) => b.callback_data);
    expect(data).toEqual(
      expect.arrayContaining(['qz:i:drives', 'qz:i:critic', 'qz:i:battery']),
    );
  });

  it('/test (единственное число) — алиас, открывает тот же список', async () => {
    boot();
    const ctx = await runCommand(fakeBot, 'test');
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toContain('Мини-тесты');
  });

  it('интро отвечает «что это и зачем» и ведёт в приложение', async () => {
    boot();
    const ctx = await runAction(fakeBot, 'qz:i:drives');
    expect(flat(ctx)).toContain('схема-терапии');
    expect(flat(ctx)).toContain('вопросов');
    expect(keyboardData(ctx)).toContain(`${APP_URL}/tests/drives`);
    expect(keyboardData(ctx).some((d) => d.startsWith('qz:q:'))).toBe(false);
  });

  // РКН, #1135: ответы и результат в Telegram не ездят.
  it('кнопка старого вопроса не принимает ответы: только «пройти в приложении»', async () => {
    boot();
    const ctx = await runAction(fakeBot, 'qz:q:drives:3:012');
    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(flat(ctx)).toContain('в приложении');
    expect(flat(ctx)).not.toContain('вопрос 4');
    expect(keyboardData(ctx)).toContain(`${APP_URL}/tests/drives`);
    const ctx2 = await runAction(fakeBot, 'qz:q:nosuch:0:');
    expect(flat(ctx2)).toContain('устарела');
  });

  it('форма «вы» из настроек меняет текст списка и результата', async () => {
    boot('vy');
    const ctx = await runAction(fakeBot, 'qz:list');
    expect(flat(ctx)).toContain('Выбирайте');
    expect(flat(ctx)).not.toContain('Выбирай:');
  });

  it('ошибка БД не роняет хендлер: форма падает в «ты», сбой уходит в лог', async () => {
    boot();
    const dbError = new Error('db down');
    botService.getUserSettings.mockRejectedValue(dbError);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const ctx = await runAction(fakeBot, 'qz:list');
    expect(flat(ctx)).toContain('Выбирай:');
    expect(warnSpy).toHaveBeenCalledWith('quiz getForm failed', dbError);
    warnSpy.mockRestore();
  });

  // Аудит 2026-10: catch квиза только писал в лог — человек нажимал кнопку
  // и не видел ничего. Теперь исход приходит сообщением (failCallback).
  it.each([
    ['command', 'tests'],
    ['action', 'qz:list'],
    ['action', 'qz:i:critic'],
  ])(
    'сбой резолвера аккаунта (%s %s) — человек получает исход',
    async (kind, name) => {
      fakeBot = makeFakeBot();
      const errSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      new TelegramQuizService(
        fakeBot.bot,
        { getUserSettings: jest.fn() } as any,
        {
          canonicalUserId: jest.fn().mockRejectedValue(new Error('db down')),
        } as any,
      ).onModuleInit();
      const ctx =
        kind === 'command'
          ? await runCommand(fakeBot, name)
          : await runAction(fakeBot, name);
      expect(ctx.reply).toHaveBeenCalledWith(ERROR_RETRY);
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    },
  );
});
