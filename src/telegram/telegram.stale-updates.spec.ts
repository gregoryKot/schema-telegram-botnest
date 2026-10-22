// Предохранители «хвоста» очереди после деплоя (backend#16, см. шапку
// telegram.stale-updates.ts). Настоящий Telegraf с настоящими апдейтами, как в
// private-chat-only.seam.spec.ts; сеть перехвачена на Telegram.prototype.callApi.
import { Telegraf, Telegram, Context } from 'telegraf';
import type { Update } from 'telegraf/types';
import {
  SEEN_UPDATES_LIMIT,
  STALE_MESSAGE_MS,
  isExpiredCallbackQuery,
  staleUpdateGuard,
} from './telegram.stale-updates';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const sec = (ms: number) => Math.floor(ms / 1000);
const from = { id: 42, is_bot: false, first_name: 'Т' };
const chat = { id: 42, type: 'private' as const };

const message = (update_id: number, sentMs: number): Update =>
  ({
    update_id,
    message: { message_id: 1, date: sec(sentMs), chat, from, text: 'hi' },
  }) as Update;

const button = (update_id: number, messageDateMs: number): Update =>
  ({
    update_id,
    callback_query: {
      id: 'q',
      chat_instance: 'c',
      from,
      data: 'tap',
      message: { message_id: 1, date: sec(messageDateMs), chat },
    },
  }) as Update;

function makeBot() {
  const bot = new Telegraf<Context>('123456:TEST-TOKEN-NOT-USED');
  bot.botInfo = {
    id: 123456,
    is_bot: true,
    first_name: 'Т',
    username: 'TestBot',
  } as never;
  const logger = { log: jest.fn() };
  bot.use(staleUpdateGuard(() => NOW, logger));
  const seen = jest.fn();
  bot.on('message', (ctx) => seen('message', ctx.update.update_id));
  bot.action('tap', async (ctx) => {
    seen('tap', await ctx.answerCbQuery());
  });
  return { bot, seen, logger };
}

afterEach(() => jest.restoreAllMocks());

describe('staleUpdateGuard: сообщения', () => {
  it('свежее сообщение (минута назад) доходит до хендлера', async () => {
    const { bot, seen } = makeBot();
    await bot.handleUpdate(message(1, NOW - 60_000));
    expect(seen).toHaveBeenCalledWith('message', 1);
  });

  it('ровно на границе окна — ещё обрабатывается', async () => {
    const { bot, seen, logger } = makeBot();
    await bot.handleUpdate(message(1, NOW - STALE_MESSAGE_MS));
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith('message', 1);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('старше 10 минут отбрасывается и логируется, хендлер не зовётся', async () => {
    const { bot, seen, logger } = makeBot();
    await bot.handleUpdate(message(1, NOW - STALE_MESSAGE_MS - 1_000));
    expect(seen).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('update 1'),
    );
  });
});

describe('staleUpdateGuard: кнопки', () => {
  it('кнопка под вчерашним сообщением НЕ отбрасывается (дата сообщения ≠ дата нажатия)', async () => {
    jest.spyOn(Telegram.prototype, 'callApi').mockResolvedValue(true);
    const { bot, seen } = makeBot();
    await bot.handleUpdate(button(1, NOW - 86_400_000));
    expect(seen).toHaveBeenCalledWith('tap', true);
  });

  it('просроченное подтверждение нажатия глотается: действие хендлера выполняется', async () => {
    jest.spyOn(Telegram.prototype, 'callApi').mockRejectedValue(
      Object.assign(new Error('400: Bad Request: query is too old'), {
        description:
          'Bad Request: query is too old and response timeout expired or query ID is invalid',
      }),
    );
    const { bot, seen } = makeBot();
    await bot.handleUpdate(button(1, NOW));
    expect(seen).toHaveBeenCalledWith('tap', true);
  });

  it('другая ошибка подтверждения (контроль) пробрасывается как раньше', async () => {
    jest
      .spyOn(Telegram.prototype, 'callApi')
      .mockRejectedValue(new Error('ETIMEDOUT'));
    const { bot } = makeBot();
    // Свой bot.catch, а не обработчик Telegraf по умолчанию: тот ставит
    // process.exitCode = 1, и в одном процессе (--detectOpenHandles в
    // nightly) jest выходил с кодом 1 при всех зелёных сьютах.
    const caught: unknown[] = [];
    bot.catch((err) => void caught.push(err));
    await bot.handleUpdate(button(1, NOW));
    expect(caught).toEqual([expect.objectContaining({ message: 'ETIMEDOUT' })]);
  });
});

describe('staleUpdateGuard: повторная доставка', () => {
  it('одинаковый update_id второй раз не обрабатывается', async () => {
    const { bot, seen } = makeBot();
    await bot.handleUpdate(message(7, NOW));
    await bot.handleUpdate(message(7, NOW));
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith('message', 7);
  });

  it('память ограничена: самый старый id забывается после лимита', async () => {
    const { bot, seen } = makeBot();
    for (let id = 1; id <= SEEN_UPDATES_LIMIT + 1; id++) {
      await bot.handleUpdate(message(id, NOW));
    }
    seen.mockClear();
    await bot.handleUpdate(message(SEEN_UPDATES_LIMIT + 1, NOW)); // свежий — дубль
    await bot.handleUpdate(message(1, NOW)); // вытеснен — снова проходит
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith('message', 1);
  });
});

describe('isExpiredCallbackQuery', () => {
  it.each([
    ['Bad Request: query is too old and response timeout expired', true],
    ['Bad Request: QUERY ID IS INVALID', true],
    ['Bad Request: message is not modified', false],
    ['ETIMEDOUT', false],
  ])('%s → %s', (description, expected) => {
    expect(isExpiredCallbackQuery({ description })).toBe(expected);
  });
});
