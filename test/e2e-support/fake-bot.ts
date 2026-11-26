// Стаб Telegraf-инстанса для e2e-смоука. Бот НЕ обязан ходить в Telegram —
// подменяем провайдер TELEGRAF_BOT (src/telegram/telegram.providers.ts),
// иначе сборка AppModule реально резолвит BOT_TOKEN и стучится в Telegram
// API за getMe() при старте.
// Сервисы TelegramModule (telegram.service.ts, telegram.schedule.service.ts,
// telegram.settings.service.ts, telegram.notify-*.service.ts) регистрируют
// хендлеры через bot.command()/bot.action()/bot.on() в onModuleInit() и
// иногда вызывают bot.launch()/telegram.sendMessage()/callApi() (очередь
// уведомлений) — здесь все no-op, HTTP-хендлеры бота в смоуке не зовутся.
export function makeFakeBot(): any {
  const chain = () => fakeBot;
  const fakeBot: any = {
    command: jest.fn(chain),
    action: jest.fn(chain),
    on: jest.fn(chain),
    hears: jest.fn(chain),
    use: jest.fn(chain),
    catch: jest.fn(chain),
    launch: jest.fn(() => new Promise<void>(() => undefined)),
    stop: jest.fn(),
    telegram: {
      getMe: jest.fn(() =>
        Promise.resolve({ id: 1, is_bot: true, username: 'test_bot' }),
      ),
      sendMessage: jest.fn(() => Promise.resolve({ message_id: 1 })),
      callApi: jest.fn(() => Promise.resolve({ message_id: 1 })),
    },
  };
  return fakeBot;
}
