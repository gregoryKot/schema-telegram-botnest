// Транспорт писем Yandex Cloud Postbox: что именно уходит на площадку (адрес,
// тело, подпись SigV4) и как читается её отказ. Отказ подписи — ЗАПИСАННЫЙ
// ответ площадки (test/fixtures/recorded/postbox-send-email-denied.json,
// правило №23), а не догадка: он пришёл text/plain, не JSON.
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import { encodeFromName } from './email-from-name';
import {
  DEFAULT_EMAIL_FROM,
  emailFrom,
  parsePostboxError,
  postboxCredentials,
  postboxRequest,
  POSTBOX_SEND_URL,
  sendPostboxEmail,
} from './postbox-mail';
import { computeSignature, sha256Hex } from './s3-sigv4';

interface RecordedAnswer {
  status: number;
  contentType: string;
  body: string;
}
const DENIED = (
  JSON.parse(loadRecordedFixture('postbox-send-email-denied.json')) as {
    responses: Record<'unsigned' | 'badSignature', RecordedAnswer>;
  }
).responses;

// Заглушки, не ключи: настоящих значений в репозитории нет.
const CREDS = {
  accessKeyId: 'TEST_KEY_ID',
  secretAccessKey: 'test-secret-not-a-real-key',
  region: 'ru-central1',
};
const NOW = new Date('2026-11-12T10:15:00.000Z');
const MSG = {
  from: 'Schema Happens <no-reply@schemehappens.ru>',
  to: 'reader@example.com',
  subject: 'Вход в кабинет',
  text: 'Ссылка для входа: https://schemehappens.ru/x',
};

const answer = (a: RecordedAnswer): Response =>
  new Response(a.body, {
    status: a.status,
    headers: { 'content-type': a.contentType },
  });
const accepted = (): Response =>
  new Response('{"MessageId":"test-message-id"}', { status: 200 });

let fetchSpy: jest.SpiedFunction<typeof fetch>;
beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
});
afterEach(() => jest.restoreAllMocks());

/** Единственный запрос, ушедший в fetch: адрес, заголовки, тело. */
function sent() {
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url, init] = fetchSpy.mock.calls[0];
  return {
    url: String(url),
    init: init as RequestInit,
    headers: init?.headers as Record<string, string>,
    body: String(init?.body),
  };
}

describe('postboxCredentials', () => {
  const full = {
    POSTBOX_ACCESS_KEY_ID: ' TEST_KEY_ID ',
    POSTBOX_SECRET_ACCESS_KEY: 'test-secret-not-a-real-key',
  };

  it('оба ключа заданы — ключи без пробелов по краям и регион ru-central1', () => {
    expect(postboxCredentials(full)).toEqual(CREDS);
  });

  it.each(['POSTBOX_ACCESS_KEY_ID', 'POSTBOX_SECRET_ACCESS_KEY'] as const)(
    'нет %s (или пустая строка) — null: почта не настроена',
    (name) => {
      expect(postboxCredentials({ ...full, [name]: undefined })).toBeNull();
      expect(postboxCredentials({ ...full, [name]: '   ' })).toBeNull();
    },
  );
});

describe('emailFrom', () => {
  const original = process.env.EMAIL_FROM;
  afterEach(() => {
    if (original === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = original;
  });

  it('EMAIL_FROM не задан или пуст — единый отправитель по умолчанию', () => {
    delete process.env.EMAIL_FROM;
    expect(emailFrom()).toBe(DEFAULT_EMAIL_FROM);
    process.env.EMAIL_FROM = '  ';
    expect(emailFrom()).toBe('Schema Happens <no-reply@schemehappens.ru>');
  });

  it('EMAIL_FROM задан — берётся он', () => {
    process.env.EMAIL_FROM = 'Bot <bot@example.com>';
    expect(emailFrom()).toBe('Bot <bot@example.com>');
  });

  it('имя с кириллицей — словом RFC 2047, адрес как есть', () => {
    process.env.EMAIL_FROM = 'Схема <bot@example.com>';
    const word = Buffer.from('Схема', 'utf8').toString('base64');
    expect(emailFrom()).toBe(`=?UTF-8?B?${word}?= <bot@example.com>`);
  });

  it('имя в кавычках — кавычки снимаются перед кодированием; голый адрес не трогается', () => {
    const word = Buffer.from('Схема Х', 'utf8').toString('base64');
    expect(encodeFromName('"Схема Х" <a@b.ru>')).toBe(
      `=?UTF-8?B?${word}?= <a@b.ru>`,
    );
    expect(encodeFromName('a@b.ru')).toBe('a@b.ru');
  });
});

describe('sendPostboxEmail — запрос', () => {
  it('POST на эндпоинт отправки с телом SES v2: отправитель, получатель, тема и текст в UTF-8', async () => {
    fetchSpy.mockResolvedValue(accepted());

    const res = await sendPostboxEmail(MSG, { credentials: CREDS, now: NOW });

    expect(res).toEqual({ ok: true, status: 200 });
    const { url, init, body } = sent();
    expect(url).toBe(
      'https://postbox.cloud.yandex.net/v2/email/outbound-emails',
    );
    expect(url).toBe(POSTBOX_SEND_URL);
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(body)).toEqual({
      FromEmailAddress: MSG.from,
      Destination: { ToAddresses: ['reader@example.com'] },
      Content: {
        Simple: {
          Subject: { Data: 'Вход в кабинет', Charset: 'UTF-8' },
          Body: { Text: { Data: MSG.text, Charset: 'UTF-8' } },
        },
      },
    });
  });

  it('подпись SigV4: дата из now, регион ru-central1, сервис ses, без x-amz-content-sha256', async () => {
    fetchSpy.mockResolvedValue(accepted());

    await sendPostboxEmail(MSG, { credentials: CREDS, now: NOW });

    const { headers } = sent();
    expect(headers['x-amz-date']).toBe('20261112T101500Z');
    expect(headers['content-type']).toBe('application/json');
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=TEST_KEY_ID\/20261112\/ru-central1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    // x-amz-content-sha256 обязателен только у S3; host ставит сам fetch.
    expect(Object.keys(headers).sort()).toEqual([
      'authorization',
      'content-type',
      'x-amz-date',
    ]);
    expect(headers.authorization).not.toContain(CREDS.secretAccessKey);
  });

  // Шов (правило №14): подпись пересчитывается по тому, что реально ушло в
  // fetch, — так же площадка сверяет её с пришедшим запросом.
  it('подписано ровно то, что отправлено: хост эндпоинта и хеш отправленного тела', async () => {
    fetchSpy.mockResolvedValue(accepted());

    await sendPostboxEmail(MSG, { credentials: CREDS, now: NOW });

    const { url, headers, body } = sent();
    const target = new URL(url);
    const expected = computeSignature({
      method: 'POST',
      path: target.pathname,
      query: target.search,
      headers: {
        'content-type': headers['content-type'],
        host: target.host,
        'x-amz-date': headers['x-amz-date'],
      },
      payloadHash: sha256Hex(body),
      amzDate: headers['x-amz-date'],
      region: 'ru-central1',
      service: 'ses',
      secretAccessKey: CREDS.secretAccessKey,
    });
    expect(headers.authorization).toContain(`Signature=${expected.signature}`);
  });

  it('подпись детерминирована и зависит от тела и от момента', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(accepted()));
    const authz = async (msg: typeof MSG, now: Date) => {
      fetchSpy.mockClear();
      await sendPostboxEmail(msg, { credentials: CREDS, now });
      return sent().headers.authorization;
    };

    const first = await authz(MSG, NOW);
    expect(await authz(MSG, NOW)).toBe(first);
    expect(await authz({ ...MSG, text: 'другой текст' }, NOW)).not.toBe(first);
    expect(await authz(MSG, new Date('2026-11-12T10:15:01.000Z'))).not.toBe(
      first,
    );
  });

  it('ключи не переданы — берутся из env', async () => {
    fetchSpy.mockResolvedValue(accepted());
    jest.replaceProperty(process, 'env', {
      ...process.env,
      POSTBOX_ACCESS_KEY_ID: 'ENV_KEY_ID',
      POSTBOX_SECRET_ACCESS_KEY: 'env-secret-not-a-real-key',
    });

    await sendPostboxEmail(MSG, { now: NOW });

    expect(sent().headers.authorization).toContain('Credential=ENV_KEY_ID/');
  });

  it('ключей нет вовсе — ошибка до запроса, в сеть ничего не уходит', async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      POSTBOX_ACCESS_KEY_ID: undefined,
      POSTBOX_SECRET_ACCESS_KEY: undefined,
    });

    await expect(postboxRequest({})).rejects.toThrow('ключи подписи не заданы');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('sendPostboxEmail — ответ площадки', () => {
  it.each(['unsigned', 'badSignature'] as const)(
    'записанный отказ подписи (%s): 403 text/plain → ok:false, причина «Forbidden»',
    async (name) => {
      fetchSpy.mockResolvedValue(answer(DENIED[name]));

      const res = await sendPostboxEmail(MSG, {
        credentials: CREDS,
        now: NOW,
      });

      expect(res).toEqual({ ok: false, status: 403, error: 'Forbidden' });
    },
  );

  it('тело отказа не прочиталось — причина «HTTP <статус>», статус сохранён', async () => {
    const broken = new Response(null, { status: 502 });
    jest.spyOn(broken, 'text').mockRejectedValue(new Error('aborted'));
    fetchSpy.mockResolvedValue(broken);

    const res = await sendPostboxEmail(MSG, { credentials: CREDS });

    expect(res).toEqual({ ok: false, status: 502, error: 'HTTP 502' });
  });

  it('сеть не ответила — ошибка пробрасывается вызывающему', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNRESET'));
    await expect(sendPostboxEmail(MSG, { credentials: CREDS })).rejects.toThrow(
      'ECONNRESET',
    );
  });

  it('таймаут — TimeoutError пробрасывается как есть (по имени его узнаёт снимок почты)', async () => {
    fetchSpy.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    await expect(
      sendPostboxEmail(MSG, { credentials: CREDS, timeoutMs: 5 }),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('parsePostboxError', () => {
  it('записанный отказ подписи — не JSON: текст ответа без перевода строки', () => {
    const { status, body } = DENIED.unsigned;
    expect(body).toBe('Forbidden\n');
    expect(parsePostboxError(status, body)).toBe('Forbidden');
  });

  // Форма по документации Postbox (yandex.cloud/ru/docs/postbox), не запись:
  // живой ответ запишем в фикстуру после выкладки.
  it.each([
    [
      400,
      '{"Code":"BadRequestException","message":"Destination is required"}',
      'BadRequestException: Destination is required',
    ],
    [
      429,
      '{"Code":"TooManyRequestsException","message":"Rate exceeded"}',
      'TooManyRequestsException: Rate exceeded',
    ],
    [400, '{"Code":"MessageRejected"}', 'MessageRejected'],
    [404, '{"message":"Identity not found"}', 'Identity not found'],
  ])(
    'JSON с Code/message (HTTP %i) → «Code: message»',
    (status, body, want) => {
      expect(parsePostboxError(status, body)).toBe(want);
    },
  );

  it('пустое тело — «HTTP <статус>»', () => {
    expect(parsePostboxError(502, '')).toBe('HTTP 502');
    expect(parsePostboxError(500, ' \n')).toBe('HTTP 500');
  });

  it('JSON незнакомой формы и не-объект — текст ответа как есть', () => {
    expect(parsePostboxError(400, '{"error":"x"}')).toBe('{"error":"x"}');
    expect(parsePostboxError(400, 'null')).toBe('null');
    expect(parsePostboxError(400, '"oops"')).toBe('"oops"');
  });

  it('длинный ответ обрезается до 200 символов', () => {
    expect(parsePostboxError(500, 'x'.repeat(5000))).toHaveLength(200);
    const long = JSON.stringify({ Code: 'E', message: 'm'.repeat(5000) });
    expect(parsePostboxError(400, long)).toHaveLength(200);
  });

  it('адрес почты из ответа в причину не попадает', () => {
    const body = JSON.stringify({
      Code: 'MessageRejected',
      message: 'Address reader@example.com is not verified',
    });
    const reason = parsePostboxError(400, body);
    expect(reason).toBe('MessageRejected: Address <адрес> is not verified');
    expect(parsePostboxError(400, 'bad <reader@example.com>')).not.toContain(
      'reader@example.com',
    );
  });
});
