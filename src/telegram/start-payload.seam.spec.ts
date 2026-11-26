// Шовный тест: payload `/start` проходит через НАСТОЯЩИЙ telegraf.
//
// Правило №14 CLAUDE.md: если предусловие в проде создаёт другой код, тест
// обязан пройти через него. Тесты `/start` подставляли поле в поддельный ctx
// руками — и потому пять месяцев зеленели на коде, который в проде не
// работал: `bot.command('start', …)` кладёт в контекст `payload`, а
// `startPayload` проставляет только `bot.start(…)` (telegraf 4.16,
// lib/composer.js:116 против :381).
//
// Здесь идёт настоящий Telegraf с настоящим апдейтом Telegram. Контрольная
// половина (второй тест) фиксирует ровно ту разницу, из-за которой баг жил:
// без неё тест не доказывал бы ничего.
import { Telegraf, Context } from 'telegraf';
import type { Update } from 'telegraf/types';
import { readStartPayload } from './start-payload';

/** Апдейт ровно того вида, что присылает Telegram по ссылке `?start=<payload>`. */
function startUpdate(text: string): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 42, type: 'private', first_name: 'Тест' },
      from: { id: 42, is_bot: false, first_name: 'Тест' },
      text,
      entities: [{ type: 'bot_command', offset: 0, length: '/start'.length }],
    },
  } as unknown as Update;
}

/** Регистрирует хендлер ТАК ЖЕ, как прод (`bot.command('start', …)`). */
async function captureCtx(text: string): Promise<Context> {
  const bot = new Telegraf('123456:TEST-TOKEN-NOT-USED');
  // Без botInfo telegraf сходил бы в сеть за getMe. Подставляем — это
  // единственное, что здесь поддельное: разбор команды остаётся настоящим.
  bot.botInfo = {
    id: 123456,
    is_bot: true,
    first_name: 'Тест',
    username: 'TestBot',
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  };
  let captured: Context | null = null;
  bot.command('start', (ctx) => {
    captured = ctx;
  });
  await bot.handleUpdate(startUpdate(text));
  if (!captured) throw new Error('хендлер /start не был вызван');
  return captured;
}

describe('readStartPayload — шов с настоящим telegraf', () => {
  it('достаёт payload из /start, зарегистрированного как в проде', async () => {
    const ctx = await captureCtx('/start login_K7M2QX94');
    expect(readStartPayload(ctx)).toBe('login_K7M2QX94');
  });

  it('/start без payload — undefined, а не пустая строка', async () => {
    const ctx = await captureCtx('/start');
    expect(readStartPayload(ctx)).toBeUndefined();
  });

  it('контроль: startPayload у bot.command пуст — из-за этого баг и жил', async () => {
    const ctx = await captureCtx('/start src_seed1');
    // Именно это поле читал прод до 2026-08-28. Если однажды telegraf начнёт
    // его проставлять и у command, тест упадёт — и это повод перечитать
    // start-payload.ts, а не «просто поправить ожидание».
    expect(
      (ctx as Context & { startPayload?: string }).startPayload,
    ).toBeUndefined();
    // А то поле, которое читаем мы, — на месте.
    expect((ctx as Context & { payload?: string }).payload).toBe('src_seed1');
  });
});
