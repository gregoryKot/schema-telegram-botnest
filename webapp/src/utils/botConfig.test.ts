import { describe, it, expect } from 'vitest';
import { botUsername, botHandle, botUrl, botShortUrl } from './botConfig';

// Сверяем, что все формы username выводятся из одного источника и не разъезжаются
// (после переезда бота меняется только VITE_BOT_USERNAME — всё остальное следом).
// miniappDeepLink живёт в парном schema-miniapp/botConfig и строится по той же
// схеме `https://t.me/<bot>/...` — здесь покрыта базовая деривация username.
describe('botConfig', () => {
  it('формы @handle / url / short-url согласованы с username', () => {
    expect(botHandle).toBe(`@${botUsername}`);
    expect(botUrl).toBe(`https://t.me/${botUsername}`);
    expect(botShortUrl).toBe(`t.me/${botUsername}`);
  });

  it('username непустой (есть дефолт при отсутствии env)', () => {
    expect(botUsername.length).toBeGreaterThan(0);
  });
});
