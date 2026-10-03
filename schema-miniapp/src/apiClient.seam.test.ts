// @vitest-environment jsdom
// Тест на шве (правило №14), инцидент 2026-10-03. Сервер на «нет записи» отдаёт
// ПУСТОЕ тело (Nest: `return null` → response.send() без аргумента; e2e
// сервера пинит `''`), а юнит-тесты фронта мокали уже распарсенный null — каждая
// сторона была проверена, шов между ними нет. Транспорт звал res.json() на
// пустом теле → SyntaxError → у тех, кто не начинал тест схем, экран теста
// показывал «не удалось проверить прогресс». Здесь на шве: настоящий Response
// с пустым телом → get().
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get, postJson } from './apiClient';
import { clearSession } from './session';
import { clearApiCache } from '../../shared/src/api/apiCache';

beforeEach(() => {
  clearSession();
  clearApiCache();
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: 'query_id=AAA&hash=deadbeef' },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

describe('пустое тело успешного ответа — это null, а не поломка', () => {
  it.each(['/api/ysq-progress', '/api/ysq-result'])(
    'get(%s) на 200 с пустым телом резолвится в null',
    async (path) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 200 })),
      );
      await expect(get(path)).resolves.toBeNull();
    },
  );

  it('postJson на 200 с пустым телом резолвится в null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 200 })),
    );
    await expect(postJson('/api/anything', {})).resolves.toBeNull();
  });

  it('непустое невалидное тело по-прежнему отклоняется', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<html>502</html>', { status: 200 })),
    );
    await expect(get('/api/ysq-progress')).rejects.toThrow(SyntaxError);
  });

  it('закешированный null не считается промахом — второй get не ходит в сеть', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await get('/api/ysq-progress');
    await expect(get('/api/ysq-progress')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
