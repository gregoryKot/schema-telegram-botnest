// HTTP площадок: причина сбоя обязана доехать до владельца целиком — статус и
// тело. Инцидент 2026-07-29 (алерт «не дошло» без причины) случился ровно из-за
// потерянной диагностики, поэтому она под тестом.
import {
  ChannelHttpError,
  describeHttpError,
  getJson,
  postForm,
  postJson,
} from './channel-http';

function mockFetch(res: {
  ok?: boolean;
  status?: number;
  text: string;
}): jest.Mock {
  const fn = jest.fn().mockResolvedValue({
    ok: res.ok ?? true,
    status: res.status ?? 200,
    text: () => Promise.resolve(res.text),
  });
  global.fetch = fn;
  return fn;
}

describe('channel-http', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('postJson шлёт JSON и отдаёт разобранный ответ', async () => {
    const fetchMock = mockFetch({ text: '{"id":"42"}' });
    const res = await postJson('https://api.test/pins', { a: 1 }, { x: 'y' });
    expect(res).toEqual({ id: '42' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/pins');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      x: 'y',
    });
  });

  it('postForm кодирует параметры в форму (так принимает VK)', async () => {
    const fetchMock = mockFetch({ text: '{"response":{"post_id":7}}' });
    await postForm('https://api.vk.com/method/wall.post', {
      message: 'фраза с пробелом',
      from_group: '1',
    });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(init.body).toBe(
      'message=%D1%84%D1%80%D0%B0%D0%B7%D0%B0+%D1%81+%D0%BF%D1%80%D0%BE%D0%B1%D0%B5%D0%BB%D0%BE%D0%BC&from_group=1',
    );
  });

  it('не-2xx превращается в ошибку со статусом и телом', async () => {
    mockFetch({ ok: false, status: 403, text: 'no access to board' });
    await expect(getJson('https://api.test/x')).rejects.toThrow(
      '403: no access to board',
    );
  });

  it('200 с не-JSON телом — тоже сбой, а не тихий успех', async () => {
    mockFetch({ text: '<html>maintenance</html>' });
    await expect(getJson('https://api.test/x')).rejects.toBeInstanceOf(
      ChannelHttpError,
    );
  });

  it('пустое тело при 200 — это успех без данных', async () => {
    mockFetch({ text: '' });
    await expect(getJson('https://api.test/x')).resolves.toEqual({});
  });

  describe('describeHttpError', () => {
    it('ответ площадки — статус с телом', () => {
      expect(describeHttpError(new ChannelHttpError(400, 'bad token'))).toBe(
        '400: bad token',
      );
    });

    it('таймаут объясняется словами, а не именем класса', () => {
      const err = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      expect(describeHttpError(err)).toContain('не ответила');
    });

    it('обрыв сети показывает код транспорта', () => {
      const err = Object.assign(new Error('connect failed'), {
        code: 'ECONNREFUSED',
      });
      expect(describeHttpError(err)).toBe('ECONNREFUSED (connect failed)');
    });

    it('fetch failed показывает настоящую причину из cause', () => {
      // Так undici заворачивает недоступный домен: снаружи «fetch failed»,
      // код и детали — внутри cause.
      const err = Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(
          new Error('getaddrinfo ENOTFOUND graph.threads.net'),
          {
            code: 'ENOTFOUND',
          },
        ),
      });
      const described = describeHttpError(err);
      expect(described).toContain('ENOTFOUND');
      expect(described).toContain('graph.threads.net');
    });

    it('пустая ошибка не превращается в пустую строку', () => {
      expect(describeHttpError(null)).toBe('неизвестная ошибка');
    });
  });
});
