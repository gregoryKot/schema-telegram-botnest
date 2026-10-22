// Шов «константа → кнопка бота» (аудит 2026-10, infra#18): webApp-кнопки
// получали vercel-адрес, потому что тест проверял только саму константу.
// Здесь — то, что реально уходит в Telegram в web_app.url.
import { buildWelcomeKeyboard } from './telegram.keyboards';
import { MINIAPP_ONLY_KEYBOARD } from './telegram.reply-helpers';

type Button = { text: string; web_app?: { url: string } };

const flat = (kb: {
  reply_markup: { inline_keyboard: Button[][] };
}): Button[] => kb.reply_markup.inline_keyboard.flat();

describe('webApp-кнопки бота ведут в мини-апп канонического хоста', () => {
  it('приветствие: кнопка «Открыть» ведёт в кабинет — https://schemehappens.ru/today', () => {
    const open = flat(buildWelcomeKeyboard() as never).find((b) => b.web_app);
    expect(open?.web_app?.url).toBe('https://schemehappens.ru/today');
  });

  it('MINIAPP_ONLY_KEYBOARD: единственная кнопка — тот же адрес', () => {
    const buttons = flat(MINIAPP_ONLY_KEYBOARD);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].web_app?.url).toBe('https://schemehappens.ru/today');
  });
});
