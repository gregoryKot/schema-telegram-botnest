// Чьей сессией можно одобрить вход в браузер (confirm-login): только аккаунт
// со входом VK ID, Яндекс ID или MAX. Почта и прежний Google — не вход
// (решение владельца, ч. 10 ст. 8 149-ФЗ), Telegram — только внутри Telegram.
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { assertSiteAccount, assertSiteTicket } from './site-login';

const USER = 555n;

/** Фейк count: фильтр provider (строка или `{ in }`) применяется к строкам. */
function prismaWith(providers: string[]): PrismaService {
  type Where = { userId: bigint; provider: string | { in: string[] } };
  const count = ({ where }: { where: Where }) => {
    const { userId, provider } = where;
    const ok = (p: string) =>
      typeof provider === 'string' ? p === provider : provider.in.includes(p);
    return Promise.resolve(userId === USER ? providers.filter(ok).length : 0);
  };
  return { authProvider: { count } } as unknown as PrismaService;
}

describe('assertSiteAccount', () => {
  it.each([[['vk']], [['yandex']], [['max']], [['email', 'vk']]])(
    'аккаунт со входом %j — одобрить вход можно',
    async (providers) => {
      await expect(
        assertSiteAccount(prismaWith(providers), USER),
      ).resolves.toBeUndefined();
    },
  );

  it.each([
    [[]],
    [['telegram']],
    [['email']],
    [['google']],
    [['email', 'telegram']],
  ])(
    'аккаунт только с %j — 400, вход в браузер не одобряется',
    async (providers) => {
      await expect(
        assertSiteAccount(prismaWith(providers), USER),
      ).rejects.toThrow(BadRequestException);
    },
  );
});

describe('assertSiteTicket', () => {
  it.each(['vk', 'yandex'])('вход под %s — билет выписывается', (p) => {
    expect(() => assertSiteTicket('login', p)).not.toThrow();
  });

  it.each(['email', 'google', 'telegram', 'max'])('вход под %s — 400', (p) => {
    expect(() => assertSiteTicket('login', p)).toThrow(BadRequestException);
  });

  // Источник привязки — любой: человек уже вошёл, к нему и привязывают.
  it.each(['email', 'google', 'telegram'])(
    'привязка под %s — без отказа',
    (p) => {
      expect(() => assertSiteTicket('link', p)).not.toThrow();
    },
  );
});
