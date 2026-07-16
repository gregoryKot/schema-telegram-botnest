import { describe, it, expect } from 'vitest';
import {
  botUsername,
  botHandle,
  botUrl,
  botShortUrl,
  miniappDeepLink,
} from './botConfig';

// Сверяем, что все формы username выводятся из одного источника и не разъезжаются
// (после переезда бота меняется только VITE_BOT_USERNAME — всё остальное следом).
describe('botConfig', () => {
  it('формы @handle / url / short-url согласованы с username', () => {
    expect(botHandle).toBe(`@${botUsername}`);
    expect(botUrl).toBe(`https://t.me/${botUsername}`);
    expect(botShortUrl).toBe(`t.me/${botUsername}`);
  });

  it('deep-link без payload ведёт в мини-апп этого же бота', () => {
    expect(miniappDeepLink()).toMatch(
      new RegExp(`^https://t\\.me/${botUsername}/[^?]+$`),
    );
  });

  it('deep-link со startapp добавляет payload к тому же базовому линку', () => {
    expect(miniappDeepLink('pair_ABC12')).toBe(
      `${miniappDeepLink()}?startapp=pair_ABC12`,
    );
  });
});
