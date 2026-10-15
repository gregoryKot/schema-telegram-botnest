import { describe, it, expect, vi, afterEach } from 'vitest';

// Все формы username выводятся из одного источника (VITE_BOT_USERNAME) и не
// разъезжаются: после переезда бота меняется только эта переменная.
// Дефолта нет (аудит 2026-10, infra#18): раньше пустая переменная молча давала
// 'SchemaLabBot'. Пустое значение в production-сборке роняет её на сборке
// (shared/src/build/requireBotUsername.test.ts), здесь — поведение модуля.
// Парный файл: schema-miniapp/src/utils/botConfig.test.ts (правило №3).
async function loadConfig(username: string | undefined) {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (username !== undefined) vi.stubEnv('VITE_BOT_USERNAME', username);
  return import('./botConfig');
}

afterEach(() => vi.unstubAllEnvs());

describe('botConfig', () => {
  it('формы @handle / url / short-url выводятся из username', async () => {
    const c = await loadConfig(' SchemeHappensBot ');
    expect(c.botUsername).toBe('SchemeHappensBot');
    expect(c.botHandle).toBe('@SchemeHappensBot');
    expect(c.botUrl).toBe('https://t.me/SchemeHappensBot');
    expect(c.botShortUrl).toBe('t.me/SchemeHappensBot');
  });

  it('без env имя пустое, а не дефолтный старый бот', async () => {
    const c = await loadConfig(undefined);
    expect(c.botUsername).toBe('');
    expect(JSON.stringify(c)).not.toContain('SchemaLabBot');
  });
});
