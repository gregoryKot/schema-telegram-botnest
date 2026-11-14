import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  countEmailOnlyAccounts,
  EmailOnlyAccountsReport,
} from './email-only-accounts';
import { WEB_USER_ID_MIN } from './user-id-range';

function prismaWith(count: jest.Mock) {
  return { user: { count } } as unknown as PrismaService;
}

describe('countEmailOnlyAccounts', () => {
  it('считает веб-аккаунты с почтой или Google и без VK, Яндекса, Telegram, MAX', async () => {
    const count = jest.fn().mockResolvedValue(3);
    await expect(countEmailOnlyAccounts(prismaWith(count))).resolves.toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: {
        id: { gte: WEB_USER_ID_MIN },
        authProviders: {
          some: { provider: { in: ['email', 'google'] } },
          none: { provider: { in: ['vk', 'yandex', 'telegram', 'max'] } },
        },
      },
    });
  });
});

describe('EmailOnlyAccountsReport', () => {
  afterEach(() => jest.restoreAllMocks());

  it('пишет в лог только число', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const report = new EmailOnlyAccountsReport(prismaWith(jest.fn().mockResolvedValue(7)));
    await report.report();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/по почте.*: 7$/));
  });

  it('сбой запроса — warn, не исключение', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const report = new EmailOnlyAccountsReport(
      prismaWith(jest.fn().mockRejectedValue(new Error('db down'))),
    );
    await expect(report.report()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });

  it('таймер снимается на закрытии модуля', () => {
    const report = new EmailOnlyAccountsReport(prismaWith(jest.fn()));
    report.onApplicationBootstrap();
    report.onModuleDestroy();
    // второй destroy не бросает: таймер уже снят
    expect(() => report.onModuleDestroy()).not.toThrow();
  });
});
