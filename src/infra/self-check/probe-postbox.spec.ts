// Живая проба ключей почты: подписанный запрос без письма на эндпоинт отправки
// Postbox. Отказ подписи — ЗАПИСАННЫЙ ответ площадки (правило №23); зелёный
// исход (400 на пустое тело) — гипотеза из порядка проверок площадки, форма
// тела — по документации: живой ответ запишем после выкладки.
import { loadRecordedFixture } from '../../test-support/recorded-fixture';
import { judgePostbox, postboxProbe } from './probe-postbox';
import { runProbes } from './runner';

const DENIED = (
  JSON.parse(loadRecordedFixture('postbox-send-email-denied.json')) as {
    responses: Record<string, { status: number; body: string }>;
  }
).responses;

// Заглушки, не ключи.
const ENV = {
  POSTBOX_ACCESS_KEY_ID: 'TEST_KEY_ID',
  POSTBOX_SECRET_ACCESS_KEY: 'test-secret-not-a-real-key',
};

let fetchSpy: jest.SpiedFunction<typeof fetch>;
beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
});
afterEach(() => jest.restoreAllMocks());

describe('postboxProbe', () => {
  it.each([{}, { POSTBOX_ACCESS_KEY_ID: 'TEST_KEY_ID' }])(
    'ключей нет (или задан один из двух) — «выключено», запрос не уходит',
    async (env) => {
      const res = await postboxProbe(env).run();
      expect(res).toEqual({ ok: true, detail: 'выключено' });
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('400 на пробный запрос — ключ принят; уходит подписанный POST с телом {}', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        '{"Code":"BadRequestException","message":"Destination is required"}',
        { status: 400 },
      ),
    );

    const res = await postboxProbe(ENV).run();

    expect(res.ok).toBe(true);
    expect(res.detail).toContain('ключ принят');
    expect(res.detail).toContain('HTTP 400: BadRequestException');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'https://postbox.cloud.yandex.net/v2/email/outbound-emails',
    );
    expect(init?.method).toBe('POST');
    // Письма в теле нет: отправлять нечего, квота не тратится.
    expect(init?.body).toBe('{}');
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toContain('Credential=TEST_KEY_ID/');
  });

  it('записанный отказ подписи (403 Forbidden) — красная, называет роль postbox.sender, ключ не раскрыт', async () => {
    const denied = DENIED.badSignature;
    fetchSpy.mockResolvedValue(
      new Response(denied.body, { status: denied.status }),
    );

    const res = await postboxProbe(ENV).run();

    expect(res.ok).toBe(false);
    expect(res.detail).toContain('postbox.sender');
    expect(res.detail).toContain('HTTP 403: Forbidden');
    expect(res.detail).not.toContain(ENV.POSTBOX_SECRET_ACCESS_KEY);
  });

  it('сеть не ответила — красная с причиной, не бросает', async () => {
    fetchSpy.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const res = await postboxProbe(ENV).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('Postbox недоступен: getaddrinfo ENOTFOUND');
  });

  it('таймаут — красная «не ответил за 8 с»', async () => {
    fetchSpy.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    const res = await postboxProbe(ENV).run();
    expect(res).toEqual({ ok: false, detail: 'Postbox не ответил за 8 с' });
  });

  it('живой запрос к стороннему хосту: повтор после вспышки связи, наружу в /health не идёт', async () => {
    const probe = postboxProbe(ENV);
    expect(probe.id).toBe('postbox');
    expect(probe.title).toBe('Почта: Postbox');
    expect(probe.retryOnce).toBe(true);
    expect(probe.reportInHealth).toBe(false);

    fetchSpy
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response('{}', { status: 400 }));
    const [entry] = await runProbes([probe], 1000, () => Promise.resolve());
    expect(entry).toMatchObject({
      id: 'postbox',
      ok: true,
      reportInHealth: false,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('judgePostbox', () => {
  it.each([400, 422])(
    'HTTP %i — тело разобрано, значит ключ принят',
    (status) => {
      expect(judgePostbox({ ok: false, status }).ok).toBe(true);
    },
  );

  it.each([401, 403])('HTTP %i — ключ отклонён', (status) => {
    const res = judgePostbox({ ok: false, status, error: 'Forbidden' });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('ключ отклонён');
  });

  it.each([500, 503])('HTTP %i — ошибка сервера Postbox', (status) => {
    const res = judgePostbox({ ok: false, status });
    expect(res.ok).toBe(false);
    expect(res.detail).toBe(
      `Postbox отвечает ошибкой сервера (HTTP ${status})`,
    );
  });

  // Ни «ключ принят», ни «ключ отклонён» по этим ответам сказать нельзя —
  // проба красная и называет ответ, чтобы вердикт можно было уточнить.
  it.each([200, 404, 429])('HTTP %i — неожиданный ответ, красная', (status) => {
    const res = judgePostbox({ ok: status === 200, status });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain(`неожиданный ответ Postbox`);
    expect(res.detail).toContain(`HTTP ${status}`);
  });
});
