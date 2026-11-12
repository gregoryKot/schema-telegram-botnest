// Инцидент 2026-10-03: вход через VK не работал с аудита C1 (VK вырезал точки
// из state). Поломка жила на стороне площадки, и нашёл её владелец. Ответы
// площадки здесь — ЗАПИСАННЫЕ (test/fixtures/recorded/), не догадка автора
// (правило №23).
import { loadRecordedFixture } from '../../test-support/recorded-fixture';
import { judgeVk, vkOAuthProbe } from './probe-oauth-providers';

interface Hop {
  status: number;
  location: string | null;
}
const rec = JSON.parse(
  loadRecordedFixture('oauth-authorize-responses.json'),
) as {
  sampleState: string;
  vkSentState: string;
  responses: Record<string, Hop>;
};
const R = rec.responses;

const ENV = {
  VK_APP_ID: '54774325',
  VK_REDIRECT_URI: 'https://schemehappens.ru/api/auth/vk/callback',
  JWT_SECRET: 'secret',
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('judgeVk (записанные ответы VK ID)', () => {
  it('принятый запрос, state вернулся целым — зелёный', () => {
    expect(judgeVk(R.vkAccepted, rec.vkSentState).ok).toBe(true);
  });

  it('чужой адрес возврата: VK отвечает страницей 200 — красный', () => {
    const res = judgeVk(R.vkWrongRedirect, rec.vkSentState);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('VK_REDIRECT_URI');
  });

  it('state с точками VK возвращает урезанным — красный (класс инцидента)', () => {
    // Тот же записанный ответ, но «отправили» сырой JWT: VK вернул бы его
    // без точек, а проба обязана это заметить.
    const res = judgeVk(R.vkAccepted, rec.sampleState);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('state изменённым');
  });
});

describe('пробы целиком', () => {
  it('не настроено — выключено, в сеть не ходит', async () => {
    global.fetch = jest.fn() as never;
    expect(await vkOAuthProbe({}).run()).toEqual({
      ok: true,
      detail: 'выключено',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('VK: шлёт state настоящим кодом провайдера (без точек) и сверяет возврат', async () => {
    const fetchMock = jest.fn((url: string) => {
      const sent = new URL(url).searchParams.get('state');
      const loc = `https://id.vk.com/auth?redirect_state=${sent}`;
      return Promise.resolve({
        status: 302,
        headers: { get: () => loc },
      });
    });
    global.fetch = fetchMock as never;
    const res = await vkOAuthProbe(ENV).run();
    expect(res.ok).toBe(true);
    const sent = new URL(fetchMock.mock.calls[0][0]).searchParams.get('state');
    expect(sent).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('сеть падает — красный, а не исключение из пробы', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as never;
    const res = await vkOAuthProbe(ENV).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('timeout');
  });

  it('нет JWT_SECRET для подписи state VK — красный, а не исключение', async () => {
    global.fetch = jest.fn() as never;
    const res = await vkOAuthProbe({ ...ENV, JWT_SECRET: '' }).run();
    expect(res.ok).toBe(false);
  });
});
