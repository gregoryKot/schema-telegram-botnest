// Адаптеры площадок: у каждой свой формат запроса и свой способ сообщить об
// отказе. Проверяем ровно это — куда уходит запрос, что в нём лежит и как
// площадка гасится без env (без ключей адаптер молчит, а не роняет публикацию).
import { VkChannelTarget } from './vk.target';
import { MaxChannelTarget } from './max.target';
import { ThreadsChannelTarget } from './threads.target';
import { PinterestChannelTarget } from './pinterest.target';
import type { ThreadsTokenService } from './threads-token.service';
import { resetMaxDispatcher } from './max-ca';

// Запрос со своим диспетчером уходит клиентом из пакета undici (иначе Node
// роняет его на несовпадении версий — инцидент 2026-07-30), поэтому в тестах
// подменяем именно его, а не глобальный fetch.
const undiciFetch = jest.fn();
jest.mock('undici', () => ({
  ...jest.requireActual('undici'),
  fetch: (...args: unknown[]) => undiciFetch(...args),
}));

const post = (text = 'фраза') => ({
  text,
  image: () => Promise.resolve(Buffer.from('PNGDATA')),
});

function mockFetch(...bodies: string[]): jest.Mock {
  const fn = jest.fn();
  for (const text of bodies) {
    fn.mockResolvedValueOnce({ ok: true, status: 200, text: async () => text });
  }
  global.fetch = fn;
  return fn;
}

const ENV_KEYS = [
  'HEALTHY_ADULT_VK_GROUP',
  'HEALTHY_ADULT_VK_TOKEN',
  'HEALTHY_ADULT_MAX_CHAT',
  'HEALTHY_ADULT_MAX_TOKEN',
  'HEALTHY_ADULT_MAX_CA',
  'HEALTHY_ADULT_THREADS_USER',
  'HEALTHY_ADULT_PINTEREST_BOARD',
  'HEALTHY_ADULT_PINTEREST_TOKEN',
];

describe('адаптеры площадок', () => {
  const saved: Record<string, string | undefined> = {};
  const realFetch = global.fetch;

  beforeEach(() => {
    undiciFetch.mockReset();
    resetMaxDispatcher();
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    global.fetch = realFetch;
  });

  describe('ВКонтакте', () => {
    it('без env группы площадка выключена', () => {
      expect(new VkChannelTarget().destination()).toBeNull();
    });

    it('id группы нормализуется в clubN — хоть с минусом, хоть с префиксом', () => {
      process.env.HEALTHY_ADULT_VK_GROUP = '-123';
      expect(new VkChannelTarget().destination()).toBe('club123');
      process.env.HEALTHY_ADULT_VK_GROUP = 'club123';
      expect(new VkChannelTarget().destination()).toBe('club123');
    });

    it('постит на стену от имени сообщества', async () => {
      process.env.HEALTHY_ADULT_VK_TOKEN = 'vk-token';
      const fetchMock = mockFetch('{"response":{"post_id":9}}');
      await new VkChannelTarget().send(post('текст ЗВ'), 'club123');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.vk.com/method/wall.post');
      const body = new URLSearchParams(init.body as string);
      expect(body.get('owner_id')).toBe('-123');
      expect(body.get('from_group')).toBe('1');
      expect(body.get('message')).toBe('текст ЗВ');
      expect(body.get('access_token')).toBe('vk-token');
    });

    it('ошибка VK внутри 200-ответа считается сбоем, а не успехом', async () => {
      process.env.HEALTHY_ADULT_VK_TOKEN = 'vk-token';
      mockFetch('{"error":{"error_code":214,"error_msg":"Access denied"}}');
      await expect(
        new VkChannelTarget().send(post(), 'club123'),
      ).rejects.toThrow('214: Access denied');
    });

    it('без токена сообщения не уходят, причина названа', async () => {
      const fetchMock = mockFetch('{}');
      await expect(
        new VkChannelTarget().send(post(), 'club123'),
      ).rejects.toThrow('HEALTHY_ADULT_VK_TOKEN');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('MAX', () => {
    it('без env чата площадка выключена', () => {
      expect(new MaxChannelTarget().destination()).toBeNull();
    });

    it('шлёт текст в чат: id в query, текст в теле, токен в заголовке', async () => {
      process.env.HEALTHY_ADULT_MAX_TOKEN = 'max-token';
      const fetchMock = mockFetch('{"message":{"mid":"1"}}');
      await new MaxChannelTarget().send(post('текст ЗВ'), '-100500');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://platform-api2.max.ru/messages?chat_id=-100500');
      expect(init.body).toBe('{"text":"текст ЗВ"}');
      expect(init.headers.authorization).toBe('max-token');
    });

    it('без токена не ходит в сеть', async () => {
      const fetchMock = mockFetch('{}');
      await expect(new MaxChannelTarget().send(post(), 'c1')).rejects.toThrow(
        'HEALTHY_ADULT_MAX_TOKEN',
        'HEALTHY_ADULT_MAX_CA',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Threads', () => {
    const tokens = (token: string | null) =>
      ({ current: async () => token }) as unknown as ThreadsTokenService;

    it('без env пользователя площадка выключена', () => {
      expect(new ThreadsChannelTarget(tokens('t')).destination()).toBeNull();
    });

    it('публикует в два шага: контейнер, затем сам пост', async () => {
      const fetchMock = mockFetch('{"id":"container-1"}', '{"id":"post-1"}');
      await new ThreadsChannelTarget(tokens('th-token')).send(
        post('текст ЗВ'),
        'me',
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const first = String(fetchMock.mock.calls[0][0]);
      expect(first).toContain('/v1.0/me/threads?media_type=TEXT');
      expect(first).toContain(encodeURIComponent('текст ЗВ'));
      expect(first).toContain('access_token=th-token');
      const second = String(fetchMock.mock.calls[1][0]);
      expect(second).toContain('/threads_publish?creation_id=container-1');
    });

    it('контейнер без id не публикуется вторым шагом', async () => {
      const fetchMock = mockFetch('{"error":"nope"}');
      await expect(
        new ThreadsChannelTarget(tokens('th-token')).send(post(), 'me'),
      ).rejects.toThrow('id контейнера');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('сетевой отказ не списывается на токен', () => {
      const err = Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(
          new Error('getaddrinfo ENOTFOUND graph.threads.net'),
          {
            code: 'ENOTFOUND',
          },
        ),
      });
      const explained = new ThreadsChannelTarget({
        current: async () => 't',
      } as unknown as ThreadsTokenService).explain(err);
      expect(explained).toContain('недоступен с сервера');
      expect(explained).not.toContain('Проверь токен');
    });

    it('без токена в сеть не ходим', async () => {
      const fetchMock = mockFetch('{}');
      await expect(
        new ThreadsChannelTarget(tokens(null)).send(post(), 'me'),
      ).rejects.toThrow('токена Threads');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Pinterest', () => {
    it('без env доски площадка выключена', () => {
      expect(new PinterestChannelTarget().destination()).toBeNull();
    });

    it('создаёт пин с картинкой в base64 и фразой в описании', async () => {
      process.env.HEALTHY_ADULT_PINTEREST_TOKEN = 'pin-token';
      const fetchMock = mockFetch('{"id":"pin-1"}');
      await new PinterestChannelTarget().send(post('текст ЗВ'), 'board-9');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.pinterest.com/v5/pins');
      expect(init.headers.authorization).toBe('Bearer pin-token');
      expect(JSON.parse(init.body as string)).toEqual({
        board_id: 'board-9',
        description: 'текст ЗВ',
        media_source: {
          source_type: 'image_base64',
          content_type: 'image/png',
          data: Buffer.from('PNGDATA').toString('base64'),
        },
      });
    });

    it('слишком длинное описание обрезается, а пин всё равно уходит', async () => {
      process.env.HEALTHY_ADULT_PINTEREST_TOKEN = 'pin-token';
      const fetchMock = mockFetch('{"id":"pin-1"}');
      await new PinterestChannelTarget().send(post('я'.repeat(900)), 'board-9');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.description).toHaveLength(500);
    });
  });

  it('каждая площадка объясняет сбой и подсказывает, что чинить', () => {
    const err = { status: 401, body: 'unauthorized' };
    const explained = [
      new VkChannelTarget().explain(err),
      new MaxChannelTarget().explain(err),
      new ThreadsChannelTarget({
        current: async () => 't',
      } as unknown as ThreadsTokenService).explain(err),
      new PinterestChannelTarget().explain(err),
    ];
    expect(explained.map((e) => e.split('\n')[1])).toEqual([
      expect.stringContaining('ключ доступа сообщества'),
      expect.stringContaining('токен бота MAX'),
      expect.stringContaining('токен Threads'),
      expect.stringContaining('токен Pinterest'),
    ]);
  });
});
