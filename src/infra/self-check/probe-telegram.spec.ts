import { telegramProbe } from './probe-telegram';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('telegramProbe', () => {
  it('BOT_TOKEN не задан — выключено, не авария, fetch не зовётся', async () => {
    global.fetch = jest.fn() as never;
    const res = await telegramProbe({}).run();
    expect(res).toEqual({ ok: true, detail: 'выключено' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('getMe отвечает ok:true — проба зелёная, детали с именем бота', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: { username: 'schemehappens_bot' },
      }),
    }) as never;
    const res = await telegramProbe({
      BOT_TOKEN: 'abc',
      BOT_USERNAME: 'schemehappens_bot',
    }).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('schemehappens_bot');
  });

  it('Telegram отвечает HTTP-ошибкой — не ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false }),
    }) as never;
    const res = await telegramProbe({ BOT_TOKEN: 'bad' }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('401');
  });

  it('сеть падает — не ok, деталь из ошибки', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network unreachable')) as never;
    const res = await telegramProbe({ BOT_TOKEN: 'abc' }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('network unreachable');
  });
});

// Аудит 2026-10 (infra#18): BOT_USERNAME строит ссылки-приглашения, но с
// токеном нигде не сверялся — env прода мог вести в чужого бота.
describe('telegramProbe — сверка BOT_USERNAME с токеном', () => {
  const answerWith = (username: string) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { username } }),
    }) as never;
  };

  it('имена расходятся — не ok, в detail оба имени', async () => {
    answerWith('SchemeHappensBot');
    const res = await telegramProbe({
      BOT_TOKEN: 'abc',
      BOT_USERNAME: 'SchemaLabBot',
    }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('SchemaLabBot');
    expect(res.detail).toContain('SchemeHappensBot');
  });

  it('совпадение без учёта регистра и с @ — ok', async () => {
    answerWith('SchemeHappensBot');
    const res = await telegramProbe({
      BOT_TOKEN: 'abc',
      BOT_USERNAME: '@schemehappensbot',
    }).run();
    expect(res.ok).toBe(true);
  });

  it('токен есть, BOT_USERNAME пуст — не ok, detail называет бота', async () => {
    answerWith('SchemeHappensBot');
    const res = await telegramProbe({ BOT_TOKEN: 'abc' }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('BOT_USERNAME не задан');
    expect(res.detail).toContain('SchemeHappensBot');
  });

  it('режим переезда (BOT_REDIRECT_USERNAME) — сверки нет', async () => {
    answerWith('SchemeHappensBot');
    const res = await telegramProbe({
      BOT_TOKEN: 'abc',
      BOT_USERNAME: 'SchemaLabBot',
      BOT_REDIRECT_USERNAME: 'new_schema_bot',
    }).run();
    expect(res.ok).toBe(true);
  });
});
