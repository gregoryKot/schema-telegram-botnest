// Хвост `/start`: что человек видит, придя в бота без особого повода.
// Порядок веток важен: согласие спрашиваем ДО формы обращения, форму — ДО
// приветствия. Пропустить любую значит показать приветствие тому, кто ещё
// ничего не подтвердил.
import { sendStartWelcome } from './telegram.start-welcome';

function makeDeps(over: { consent?: boolean; streak?: number } = {}) {
  return {
    botService: {
      hasAcceptedDisclaimer: jest.fn().mockResolvedValue(over.consent ?? true),
    } as any,
    analyticsService: {
      getConsecutiveDays: jest.fn().mockResolvedValue(over.streak ?? 0),
    } as any,
  };
}

const makeCtx = (firstName?: string) =>
  ({ from: { id: 42, first_name: firstName }, reply: jest.fn() }) as any;

describe('sendStartWelcome', () => {
  it('согласие не принято — спрашиваем его и дальше не идём', async () => {
    const deps = makeDeps({ consent: false });
    const ctx = makeCtx();

    await sendStartWelcome(deps, ctx, 42n, { addressForm: 'ty' });

    expect(ctx.reply.mock.calls[0][0]).toContain('Соглашение');
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  it('форма обращения не выбрана — спрашиваем её до приветствия', async () => {
    const deps = makeDeps();
    const ctx = makeCtx();

    await sendStartWelcome(deps, ctx, 42n, { addressForm: null });

    expect(ctx.reply.mock.calls[0][0]).toContain('как удобнее общаться');
  });

  it('настроек нет вовсе — это тот же вопрос о форме, а не приветствие', async () => {
    // Приветствие новичка живёт в обработчике accept:(ty|vy): сюда человек
    // без настроек доходит только до вопроса о форме.
    const deps = makeDeps();
    const ctx = makeCtx();

    await sendStartWelcome(deps, ctx, 42n, null);

    expect(ctx.reply.mock.calls[0][0]).toContain('как удобнее общаться');
    expect(deps.analyticsService.getConsecutiveDays).not.toHaveBeenCalled();
  });

  it('возвращающийся — «с возвращением» с именем, без серии при короткой', async () => {
    const deps = makeDeps({ streak: 2 });
    const ctx = makeCtx('Ася');

    await sendStartWelcome(deps, ctx, 42n, { addressForm: 'ty' });

    expect(ctx.reply.mock.calls[0][0]).toBe('С возвращением Ася!');
  });

  it('серия от трёх дней попадает в приветствие и склоняется', async () => {
    for (const [streak, word] of [
      [3, 'дня'],
      [5, 'дней'],
    ] as const) {
      const deps = makeDeps({ streak });
      const ctx = makeCtx();
      await sendStartWelcome(deps, ctx, 42n, { addressForm: 'vy' });
      expect(ctx.reply.mock.calls[0][0]).toContain(`${streak} ${word} подряд`);
    }
  });
});
