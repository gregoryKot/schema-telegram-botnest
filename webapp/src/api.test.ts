import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, setTokenProvider } from './api';

function mockFetch(impl: (url: string, init: any) => any) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}
const ok = (json: unknown = {}) => ({ ok: true, json: async () => json });

beforeEach(() => {
  setTokenProvider(() => null);
});

describe('authHeaders', () => {
  it('добавляет Bearer-токен и Content-Type, когда токен есть', async () => {
    setTokenProvider(() => 'tok123');
    const f = mockFetch(() => ok());
    await api.getProfile();
    const init = f.mock.calls[0][1];
    expect(init.headers.Authorization).toBe('Bearer tok123');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.credentials).toBe('include');
  });

  it('без токена не шлёт Authorization', async () => {
    setTokenProvider(() => null);
    const f = mockFetch(() => ok());
    await api.getProfile();
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

describe('GET', () => {
  it('возвращает JSON при 2xx', async () => {
    mockFetch(() => ok({ name: 'Аня' }));
    expect(await api.getProfile()).toEqual({ name: 'Аня' });
  });

  it('бросает "API error: <status>" при не-2xx', async () => {
    mockFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));
    await expect(api.getProfile()).rejects.toThrow('API error: 404');
  });

  it('кодирует query-параметр date', async () => {
    const f = mockFetch(() => ok({}));
    await api.ratings('2026-06-08');
    expect(f.mock.calls[0][0]).toContain('/api/ratings?date=2026-06-08');
  });

  it('ratings без даты → без query', async () => {
    const f = mockFetch(() => ok({}));
    await api.ratings();
    expect(f.mock.calls[0][0]).toMatch(/\/api\/ratings$/);
  });
});

describe('POST', () => {
  it('шлёт метод POST и тело JSON', async () => {
    const f = mockFetch(() => ok());
    await api.saveNote('2026-06-08', 'текст', ['a']);
    const [url, init] = f.mock.calls[0];
    expect(url).toContain('/api/note');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ date: '2026-06-08', text: 'текст', tags: ['a'] });
  });

  it('извлекает message из тела ошибки', async () => {
    mockFetch(() => ({ ok: false, status: 400, json: async () => ({ message: 'Invalid name' }) }));
    await expect(api.saveNote('d', 't')).rejects.toThrow('Invalid name');
  });

  it('фолбэк на "API error: <status>", если тело без message', async () => {
    mockFetch(() => ({ ok: false, status: 500, json: async () => { throw new Error('no json'); } }));
    await expect(api.saveNote('d', 't')).rejects.toThrow('API error: 500');
  });
});

describe('postJson / del', () => {
  it('postJson возвращает JSON-ответ', async () => {
    mockFetch(() => ok({ ok: true }));
    expect(await api.updateName('Аня')).toEqual({ ok: true });
  });

  it('del шлёт DELETE', async () => {
    const f = mockFetch(() => ok());
    await api.deletePractice(7);
    const [url, init] = f.mock.calls[0];
    expect(url).toContain('/api/practices/7');
    expect(init.method).toBe('DELETE');
  });

  it('del бросает при не-2xx', async () => {
    mockFetch(() => ({ ok: false, status: 403 }));
    await expect(api.deletePractice(7)).rejects.toThrow('API error: 403');
  });
});

describe('saveRating (явный fetch)', () => {
  it('POST /api/rating с телом и возвратом JSON', async () => {
    const f = mockFetch(() => ok({ ok: true, allDone: true, streak: { currentStreak: 3 } }));
    const res = await api.saveRating('attachment', 7, '2026-06-08');
    const [url, init] = f.mock.calls[0];
    expect(url).toContain('/api/rating');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ needId: 'attachment', value: 7, date: '2026-06-08' });
    expect(res.allDone).toBe(true);
  });

  it('бросает при не-2xx', async () => {
    mockFetch(() => ({ ok: false, status: 400 }));
    await expect(api.saveRating('attachment', 11)).rejects.toThrow('API error: 400');
  });
});
