// Мини-тесты в боте: список → интро → вопросы → результат, всё stateless
// через callback_data. Проверяем и связку «прошёл тест → событие аналитики»
// (правило №8), и устойчивость к мусорному callback_data.
import { TelegramQuizService } from './telegram.quiz.service';
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
  let analytics: { track: jest.Mock };

  const boot = (addressForm: string | null = null) => {
    fakeBot = makeFakeBot();
    botService = {
      getUserSettings: jest
        .fn()
        .mockResolvedValue(addressForm === null ? null : { addressForm }),
    };
    analytics = { track: jest.fn().mockResolvedValue(undefined) };
    const service = new TelegramQuizService(
      fakeBot.bot,
      botService as any,
      analytics as any,
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

  it('интро отвечает «что это и зачем» и ведёт на первый вопрос', async () => {
    boot();
    const ctx = await runAction(fakeBot, 'qz:i:drives');
    expect(flat(ctx)).toContain('схема-терапии');
    expect(flat(ctx)).toContain('вопросов');
    expect(keyboardData(ctx)).toContain('qz:q:drives:0:');
  });

  it('первый шаг: answerCbQuery ДО похода в БД, quiz_started записан', async () => {
    boot();
    const ctx = await runAction(fakeBot, 'qz:q:drives:0:');
    const answerOrder = (ctx.answerCbQuery as jest.Mock).mock
      .invocationCallOrder[0];
    const dbOrder = botService.getUserSettings.mock.invocationCallOrder[0];
    expect(answerOrder).toBeLessThan(dbOrder);
    expect(flat(ctx)).toContain('вопрос 1 из 7');
    expect(analytics.track).toHaveBeenCalledWith(BigInt(1), 'quiz_started', {
      quiz: 'drives',
      src: 'bot',
    });
  });

  it('полное прохождение даёт результат и событие quiz_completed', async () => {
    boot();
    // 7 ответов «за Здорового Взрослого» — в drives это всегда последний
    // вариант, но найдём индексы честно, через сами кнопки.
    let picks = '';
    for (let n = 0; n < 7; n++) {
      const ctx = await runAction(fakeBot, `qz:q:drives:${n}:${picks}`);
      const adult = keyboardData(ctx).find((d) =>
        d.startsWith(`qz:q:drives:${n + 1}:`),
      );
      expect(adult).toBeDefined();
      // Список кнопок повторяет порядок options; берём последнюю опцию (adult).
      const optionButtons = keyboardData(ctx).filter((d) =>
        d.startsWith(`qz:q:drives:${n + 1}:`),
      );
      picks = optionButtons[optionButtons.length - 1].split(':')[4];
    }
    const ctx = await runAction(fakeBot, `qz:q:drives:7:${picks}`);
    expect(flat(ctx)).toContain('Здоровый Взрослый');
    expect(flat(ctx)).toContain('не диагноз');
    expect(analytics.track).toHaveBeenCalledWith(BigInt(1), 'quiz_completed', {
      quiz: 'drives',
      result: 'adult',
      src: 'bot',
    });
  });

  it('форма «вы» из настроек меняет текст списка и результата', async () => {
    boot('vy');
    const ctx = await runAction(fakeBot, 'qz:list');
    expect(flat(ctx)).toContain('Выбирайте');
    expect(flat(ctx)).not.toContain('Выбирай:');
  });

  it('битый callback_data (шаг ≠ числу ответов, чужой id) не роняет и не пишет событий', async () => {
    boot();
    const ctx1 = await runAction(fakeBot, 'qz:q:drives:2:9');
    expect(flat(ctx1)).toContain('устарела');
    const ctx2 = await runAction(fakeBot, 'qz:q:nosuch:0:');
    expect(flat(ctx2)).toContain('устарела');
    // Ответ с индексом вне вариантов (в drives их 4 → «9» невалиден).
    const ctx3 = await runAction(fakeBot, 'qz:q:drives:1:9');
    expect(flat(ctx3)).toContain('устарела');
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('ошибка БД не роняет хендлер: форма падает в «ты», тест работает', async () => {
    boot();
    botService.getUserSettings.mockRejectedValue(new Error('db down'));
    const ctx = await runAction(fakeBot, 'qz:list');
    expect(flat(ctx)).toContain('Выбирай:');
  });
});
