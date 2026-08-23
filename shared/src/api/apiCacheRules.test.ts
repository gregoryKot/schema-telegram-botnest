// Карта «мутация → инвалидация» (apiCacheRules.ts): каждая мутация сбрасывает
// СВОИ ключи и не трогает посторонние — иначе либо пользователь видит старые
// данные после сохранения, либо кеш обнуляется целиком без смысла.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cachedGet, clearApiCache } from './apiCache';
import { applyMutationInvalidation } from './apiCacheRules';

beforeEach(() => {
  clearApiCache();
});

async function seed(
  paths: string[],
): Promise<Record<string, ReturnType<typeof vi.fn>>> {
  const fetchers: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const p of paths) {
    fetchers[p] = vi.fn(() => Promise.resolve(`data:${p}`));
    await cachedGet(p, fetchers[p]);
  }
  return fetchers;
}

describe('applyMutationInvalidation', () => {
  it('GET не инвалидирует ничего', async () => {
    const f = await seed(['/api/settings']);
    applyMutationInvalidation('GET', '/api/settings', undefined);
    await cachedGet('/api/settings', f['/api/settings']);
    expect(f['/api/settings']).toHaveBeenCalledTimes(1);
  });

  it('POST /api/settings сбрасывает settings, не трогает profile', async () => {
    const f = await seed(['/api/settings', '/api/profile']);
    applyMutationInvalidation('POST', '/api/settings', '{}');
    await cachedGet('/api/settings', f['/api/settings']);
    await cachedGet('/api/profile', f['/api/profile']);
    expect(f['/api/settings']).toHaveBeenCalledTimes(2);
    expect(f['/api/profile']).toHaveBeenCalledTimes(1);
  });

  it('POST /api/note сбрасывает ТОЛЬКО ключ своей даты', async () => {
    const f = await seed([
      '/api/note?date=2026-08-01',
      '/api/note?date=2026-08-02',
    ]);
    applyMutationInvalidation(
      'POST',
      '/api/note',
      JSON.stringify({ date: '2026-08-01', text: 'x' }),
    );
    await cachedGet(
      '/api/note?date=2026-08-01',
      f['/api/note?date=2026-08-01'],
    );
    await cachedGet(
      '/api/note?date=2026-08-02',
      f['/api/note?date=2026-08-02'],
    );
    expect(f['/api/note?date=2026-08-01']).toHaveBeenCalledTimes(2);
    expect(f['/api/note?date=2026-08-02']).toHaveBeenCalledTimes(1);
  });

  it('POST /api/practices с известным needId сбрасывает только этот needId', async () => {
    const f = await seed([
      '/api/practices?needId=safety',
      '/api/practices?needId=connection',
    ]);
    applyMutationInvalidation(
      'POST',
      '/api/practices',
      JSON.stringify({ needId: 'safety', text: 'x' }),
    );
    await cachedGet(
      '/api/practices?needId=safety',
      f['/api/practices?needId=safety'],
    );
    await cachedGet(
      '/api/practices?needId=connection',
      f['/api/practices?needId=connection'],
    );
    expect(f['/api/practices?needId=safety']).toHaveBeenCalledTimes(2);
    expect(f['/api/practices?needId=connection']).toHaveBeenCalledTimes(1);
  });

  it('DELETE /api/practices/:id — needId неизвестен, сбрасывает весь ресурс (осознанный префикс)', async () => {
    const f = await seed([
      '/api/practices?needId=safety',
      '/api/practices?needId=connection',
    ]);
    applyMutationInvalidation('DELETE', '/api/practices/42', undefined);
    await cachedGet(
      '/api/practices?needId=safety',
      f['/api/practices?needId=safety'],
    );
    await cachedGet(
      '/api/practices?needId=connection',
      f['/api/practices?needId=connection'],
    );
    expect(f['/api/practices?needId=safety']).toHaveBeenCalledTimes(2);
    expect(f['/api/practices?needId=connection']).toHaveBeenCalledTimes(2);
  });

  it('DELETE /api/user — clearAll, сбрасывает вообще всё', async () => {
    const f = await seed(['/api/settings', '/api/profile', '/api/streak']);
    applyMutationInvalidation('DELETE', '/api/user', undefined);
    for (const p of Object.keys(f)) await cachedGet(p, f[p]);
    for (const p of Object.keys(f)) expect(f[p]).toHaveBeenCalledTimes(2);
  });

  it('PATCH /api/phrase-checks/:id сбрасывает список разборов', async () => {
    const f = await seed(['/api/phrase-checks']);
    applyMutationInvalidation(
      'PATCH',
      '/api/phrase-checks/7',
      JSON.stringify({ rewrite: 'x' }),
    );
    await cachedGet('/api/phrase-checks', f['/api/phrase-checks']);
    expect(f['/api/phrase-checks']).toHaveBeenCalledTimes(2);
  });

  it('неизвестный роут — ни одна запись не трогается', async () => {
    const f = await seed(['/api/settings']);
    applyMutationInvalidation('POST', '/api/does-not-exist', undefined);
    await cachedGet('/api/settings', f['/api/settings']);
    expect(f['/api/settings']).toHaveBeenCalledTimes(1);
  });
});
