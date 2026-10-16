// Шов «сбой кнопки → человек видит исход» (правило №14): настоящий Telegraf,
// настоящий staleUpdateGuard и настоящий хендлер settings:toggle; подделана
// только сеть (Telegram.prototype.callApi).
//
// До починки catch отвечал вторым answerCbQuery(ERROR_RETRY). Telegram такой
// повторный ответ отклоняет («query is too old … or query ID is invalid»), а
// staleUpdateGuard эту ошибку молча глотает — в чат не уходило ничего, и
// человек считал настройку сохранённой. Текст ошибки Telegram ниже — АВТОРСКИЙ
// (описание как в telegram.stale-updates.spec.ts); записи с прода нет.
import { Logger } from '@nestjs/common';
import { Telegraf, Telegram, Context } from 'telegraf';
import type { Update } from 'telegraf/types';
import { staleUpdateGuard } from './telegram.stale-updates';
import { TelegramSettingsService } from './telegram.settings.service';
import { ERROR_RETRY } from './telegram.constants';

const from = { id: 42, is_bot: false, first_name: 'Т' };
const chat = { id: 42, type: 'private' as const };
const NOW = Date.parse('2026-10-14T12:00:00Z');

const tap = (data: string): Update =>
  ({
    update_id: 1,
    callback_query: {
      id: 'q',
      chat_instance: 'c',
      from,
      data,
      message: {
        message_id: 7,
        date: Math.floor(NOW / 1000),
        chat,
        text: 'Настройки',
      },
    },
  }) as Update;

const TOO_OLD = Object.assign(new Error('400: Bad Request: query is too old'), {
  description:
    'Bad Request: query is too old and response timeout expired or query ID is invalid',
});

function setup(botService: object) {
  const bot = new Telegraf<Context>('123456:TEST-TOKEN-NOT-USED');
  bot.botInfo = {
    id: 1,
    is_bot: true,
    first_name: 'Т',
    username: 'B',
  } as never;
  bot.use(staleUpdateGuard(() => NOW, { log: jest.fn() }));
  new TelegramSettingsService(
    bot,
    botService as never,
    { canonicalUserId: async (id: number) => BigInt(id) } as never,
    { cancelAll: jest.fn() } as never,
    { rescheduleForUser: jest.fn() } as never,
  ).onModuleInit();
  return bot;
}

/** Первый ответ на нажатие проходит, любой повторный — как у Telegram. */
function fakeNetwork(editFails = false) {
  let answered = 0;
  return jest
    .spyOn(Telegram.prototype, 'callApi')
    .mockImplementation(async (method: string) => {
      if (method === 'answerCallbackQuery') {
        if (answered++ > 0) throw TOO_OLD;
        return true as never;
      }
      if (method === 'editMessageText' && editFails) {
        throw new Error('400: Bad Request: message can not be edited');
      }
      return true as never;
    });
}

const calls = (spy: jest.SpyInstance, method: string) =>
  spy.mock.calls.filter((c) => c[0] === method).map((c) => c[1]);

afterEach(() => jest.restoreAllMocks());

describe('settings:toggle: сбой после первого answerCbQuery', () => {
  const failing = () => ({
    getUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
    updateUserSettings: jest.fn(),
  });

  it('человек получает ошибку с кнопкой «К настройкам», а не тишину', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const spy = fakeNetwork();
    await setup(failing()).handleUpdate(tap('settings:toggle'));

    const edits = calls(spy, 'editMessageText');
    expect(edits).toHaveLength(1);
    expect(edits[0].text).toBe(ERROR_RETRY);
    expect(JSON.stringify(edits[0].reply_markup)).toContain('settings:back');
    // Ответ на нажатие ушёл ровно один раз: повтор Telegram отклонил бы.
    expect(calls(spy, 'answerCallbackQuery')).toHaveLength(1);
  });

  it('правка экрана отказала — ошибка приходит новым сообщением', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const spy = fakeNetwork(true);
    await setup(failing()).handleUpdate(tap('settings:toggle'));

    const sent = calls(spy, 'sendMessage');
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toBe(ERROR_RETRY);
  });
});
