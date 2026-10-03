// Шовный тест B1 (аудит 2026-10): карточка входа не должна появляться в
// группе и нажиматься из неё. Идёт НАСТОЯЩИЙ Telegraf с настоящими апдейтами
// и middleware, поставленным тем же `installPrivateChatOnly`, что и в проде
// (правило №14: тест стоит на шве, а не по обе его стороны).
import { Telegraf, Telegram, Context } from 'telegraf';
import type { Update } from 'telegraf/types';
import { installPrivateChatOnly } from './private-chat-only';

function makeBot(withGuard: boolean) {
  const bot = new Telegraf<Context>('123456:TEST-TOKEN-NOT-USED');
  bot.botInfo = {
    id: 123456,
    is_bot: true,
    first_name: 'Тест',
    username: 'TestBot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  };
  if (withGuard) installPrivateChatOnly(bot);
  const startSeen = jest.fn();
  const actionSeen = jest.fn();
  // Хендлеры запоминают тип чата, из которого их дёрнули: так проверка
  // «дошёл до хендлера» видит ещё и ОТКУДА дошёл, а не только факт вызова.
  bot.command('start', (ctx) => {
    startSeen(ctx.chat?.type);
  });
  bot.action(/^tglogin:yes:([A-Z0-9]{8})$/, (ctx) => {
    actionSeen(ctx.chat?.type);
  });
  // Исходящие вызовы Telegram перехватываем: сеть не нужна.
  // handleUpdate создаёт клиент заново на каждый апдейт, поэтому подменяем
  // метод на прототипе, а не на экземпляре.
  const callApi = jest
    .spyOn(Telegram.prototype, 'callApi')
    .mockResolvedValue(true);
  return { bot, startSeen, actionSeen, callApi };
}

const chat = (type: string) => ({ id: type === 'private' ? 42 : -100, type });
const from = { id: 42, is_bot: false, first_name: 'Тест' };

const startUpdate = (type: string): Update =>
  ({
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: chat(type),
      from,
      text: '/start login_ABCDEFGH',
      entities: [{ type: 'bot_command', offset: 0, length: 6 }],
    },
  }) as unknown as Update;

const tapUpdate = (type: string): Update =>
  ({
    update_id: 2,
    callback_query: {
      id: 'cb1',
      from,
      chat_instance: 'x',
      data: 'tglogin:yes:ABCDEFGH',
      message: { message_id: 5, date: 0, chat: chat(type) },
    },
  }) as unknown as Update;

afterEach(() => jest.restoreAllMocks());

describe('privateChatOnly — шов с настоящим telegraf', () => {
  it.each(['group', 'supergroup', 'channel'])(
    '/start login_ в чате типа %s: хендлер не вызван',
    async (type) => {
      const { bot, startSeen, callApi } = makeBot(true);
      await bot.handleUpdate(startUpdate(type));
      expect(startSeen).not.toHaveBeenCalled();
      // И ответа в чат нет: ни sendMessage, ни чего-либо ещё — апдейт
      // проигнорирован целиком, а не «обработан молча».
      expect(callApi.mock.calls.map((c) => c[0])).toEqual([]);
    },
  );

  it('нажатие кнопки в supergroup: только answerCbQuery, хендлер не вызван', async () => {
    const { bot, actionSeen, callApi } = makeBot(true);
    await bot.handleUpdate(tapUpdate('supergroup'));
    expect(actionSeen).not.toHaveBeenCalled();
    expect(callApi).toHaveBeenCalledTimes(1);
    expect(callApi.mock.calls[0][0]).toBe('answerCallbackQuery');
  });

  it('личный чат проходит как раньше: и команда, и кнопка', async () => {
    const { bot, startSeen, actionSeen } = makeBot(true);
    await bot.handleUpdate(startUpdate('private'));
    await bot.handleUpdate(tapUpdate('private'));
    expect(startSeen).toHaveBeenCalledWith('private');
    expect(actionSeen).toHaveBeenCalledWith('private');
  });

  it('контроль: без middleware тот же апдейт из группы доходит до хендлера', async () => {
    const { bot, startSeen, actionSeen } = makeBot(false);
    await bot.handleUpdate(startUpdate('supergroup'));
    await bot.handleUpdate(tapUpdate('supergroup'));
    expect(startSeen).toHaveBeenCalledWith('supergroup');
    expect(actionSeen).toHaveBeenCalledWith('supergroup');
  });
});
