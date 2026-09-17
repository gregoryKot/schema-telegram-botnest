// Пара методов счётчика быстрых практик «Здесь и сейчас» — общая для обоих
// фронтендов (правило №3). Тест держит контракт «метод → верный глагол, путь
// и тело»: до переноса раздела на сайт эти строки жили в api.ts мини-аппа, и
// расхождение пути/глагола между площадками было бы невидимым — сайт просто
// получал бы 404 там, где мини-апп работает.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPracticeSessionsApi } from './practiceSessionsApi';
import type { ApiTransport } from './sharedApi';

const calls: { verb: string; path: string; body?: unknown }[] = [];
const t: ApiTransport = {
  get: vi.fn(<T>(path: string) => {
    calls.push({ verb: 'get', path });
    return Promise.resolve({ breathing: 1, grounding: 2, stop: 3 } as T);
  }),
  post: vi.fn(() => Promise.resolve()),
  postJson: vi.fn(<T>(path: string, body: unknown) => {
    calls.push({ verb: 'postJson', path, body });
    return Promise.resolve({ ok: true, count: 4 } as T);
  }),
  del: vi.fn(() => Promise.resolve()),
};
const api = createPracticeSessionsApi(t);

beforeEach(() => {
  calls.length = 0;
});

describe('createPracticeSessionsApi', () => {
  it('getPracticeSessions читает счётчики GET-ом и отдаёт их как есть', async () => {
    const counts = await api.getPracticeSessions();
    expect(calls).toEqual([{ verb: 'get', path: '/api/practice-sessions' }]);
    expect(counts).toEqual({ breathing: 1, grounding: 2, stop: 3 });
  });

  it('recordPracticeSession шлёт id практики в теле POST и возвращает ответ', async () => {
    const res = await api.recordPracticeSession('stop');
    expect(calls).toEqual([
      {
        verb: 'postJson',
        path: '/api/practice-session',
        body: { tool: 'stop' },
      },
    ]);
    // read-after-write: счётчик берётся из ответа сервера, не считается локально.
    expect(res).toEqual({ ok: true, count: 4 });
  });
});
