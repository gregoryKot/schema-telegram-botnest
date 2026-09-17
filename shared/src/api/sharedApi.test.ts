// Фабрика общих API-методов (правило №3): один список эндпоинтов на оба
// фронтенда. Тест держит контракт «метод → верный глагол и путь»: смок зовёт
// КАЖДЫЙ метод через фейковый транспорт (ни один не может молча сломаться),
// точечные ассерты — за ветвящимися методами.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSharedApi, type ApiTransport } from './sharedApi';

const calls: { verb: string; path: string; body?: unknown }[] = [];
const t: ApiTransport = {
  get: vi.fn(<T>(path: string) => {
    calls.push({ verb: 'get', path });
    return Promise.resolve(null as T);
  }),
  post: vi.fn((path: string, body?: unknown) => {
    calls.push({ verb: 'post', path, body });
    return Promise.resolve();
  }),
  postJson: vi.fn(<T>(path: string, body: unknown) => {
    calls.push({ verb: 'postJson', path, body });
    return Promise.resolve(null as T);
  }),
  del: vi.fn((path: string, body?: unknown) => {
    calls.push({ verb: 'del', path, body });
    return Promise.resolve();
  }),
};
const api = buildSharedApi(t);

beforeEach(() => {
  calls.length = 0;
});

describe('buildSharedApi: смок всех методов', () => {
  it('каждый метод дёргает транспорт с /api/-путём', async () => {
    for (const [name, fn] of Object.entries(api)) {
      calls.length = 0;
      // Дженерик-аргументы: сигнатуры принимают примитивы/объекты — фейковый
      // транспорт не валидирует. Метод обязан сделать ровно ≥1 вызов /api/.
      await (fn as (...a: unknown[]) => unknown)('x', 1, 'y');
      expect(calls.length, `${name} не дошёл до транспорта`).toBeGreaterThan(0);
      for (const c of calls) {
        expect(c.path, `${name} бьёт мимо /api/: ${c.path}`).toMatch(
          /^\/api\//,
        );
      }
    }
  });
});

describe('ветвящиеся методы', () => {
  it('ratings: без даты — чистый путь, с датой — query с кодированием', async () => {
    await api.ratings();
    expect(calls[0].path).toBe('/api/ratings');
    await api.ratings('2026-01-05');
    expect(calls[1].path).toBe('/api/ratings?date=2026-01-05');
  });

  it('history: дефолт 7 дней', async () => {
    await api.history();
    expect(calls[0].path).toBe('/api/history?days=7');
  });

  it('trackEvent: fire-and-forget, ошибка транспорта не пробрасывается', () => {
    const bad: ApiTransport = {
      ...t,
      post: () => Promise.reject(new Error('сеть упала')),
    };
    const a = buildSharedApi(bad);
    expect(() => a.trackEvent('share_card', { place: 'test' })).not.toThrow();
  });

  it('leavePair: DELETE с телом — код пары уезжает в body, не в URL', async () => {
    await api.leavePair('ABC123');
    expect(calls[0]).toEqual({
      verb: 'del',
      path: '/api/pair',
      body: { code: 'ABC123' },
    });
  });

  it('createPairInvite: POST с пустым объектом (раньше webapp слал raw fetch)', async () => {
    await api.createPairInvite();
    expect(calls[0].verb).toBe('postJson');
    expect(calls[0].path).toBe('/api/pair/invite');
  });
});
