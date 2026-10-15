import { describe, it, expect, vi, afterEach } from 'vitest';

// Парный файл: webapp/src/utils/botConfig.test.ts (правило №3). Здесь ещё
// miniappDeepLink — он есть только в мини-аппе.
async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./botConfig');
}

afterEach(() => vi.unstubAllEnvs());

describe('botConfig (мини-апп)', () => {
  it('формы @handle / url / short-url выводятся из username', async () => {
    const c = await loadConfig({ VITE_BOT_USERNAME: ' SchemeHappensBot ' });
    expect(c.botUsername).toBe('SchemeHappensBot');
    expect(c.botHandle).toBe('@SchemeHappensBot');
    expect(c.botUrl).toBe('https://t.me/SchemeHappensBot');
    expect(c.botShortUrl).toBe('t.me/SchemeHappensBot');
  });

  it('без env имя пустое, а не дефолтный старый бот', async () => {
    const c = await loadConfig({});
    expect(c.botUsername).toBe('');
    expect(JSON.stringify(c)).not.toContain('SchemaLabBot');
  });

  it('miniappDeepLink: с payload и без, имя мини-аппа по умолчанию diary', async () => {
    const c = await loadConfig({ VITE_BOT_USERNAME: 'SchemeHappensBot' });
    expect(c.miniappDeepLink()).toBe('https://t.me/SchemeHappensBot/diary');
    expect(c.miniappDeepLink('pair_ABC')).toBe(
      'https://t.me/SchemeHappensBot/diary?startapp=pair_ABC',
    );
  });

  it('VITE_MINIAPP_APP_NAME перекрывает diary', async () => {
    const c = await loadConfig({
      VITE_BOT_USERNAME: 'SchemeHappensBot',
      VITE_MINIAPP_APP_NAME: 'app',
    });
    expect(c.miniappDeepLink('x')).toBe(
      'https://t.me/SchemeHappensBot/app?startapp=x',
    );
  });
});
