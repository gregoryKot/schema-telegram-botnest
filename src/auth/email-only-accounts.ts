// Сколько аккаунтов входят на сайт только по почте: есть строка email (или
// прежняя google — она открывается той же почтой, email-login-user.ts) и нет
// ни VK ID, ни Яндекс ID, ни Telegram, ни MAX. Вход по почте убирается
// (решение владельца, ч. 10 ст. 8 149-ФЗ): у этих людей не останется входа.
// Число — в лог после старта: только счётчик, без адресов и id.
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatchupTimer } from '../telegram/telegram.catchup-timer';
import { WEB_USER_ID_MIN } from './user-id-range';

const EMAIL_LOGINS = ['email', 'google'];
/** Входы, которые остаются: на сайте (VK ID, Яндекс ID) и внутри мессенджеров. */
const KEPT_LOGINS = ['vk', 'yandex', 'telegram', 'max'];
const REPORT_DELAY_MS = 30_000;

export function countEmailOnlyAccounts(
  prisma: Pick<PrismaService, 'user'>,
): Promise<number> {
  return prisma.user.count({
    where: {
      // Номер ниже — сам telegramId: вход в Telegram есть и без строки.
      id: { gte: WEB_USER_ID_MIN },
      authProviders: {
        some: { provider: { in: EMAIL_LOGINS } },
        none: { provider: { in: KEPT_LOGINS } },
      },
    },
  });
}

@Injectable()
export class EmailOnlyAccountsReport
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('EmailOnlyAccounts');
  private readonly timer = new CatchupTimer();

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    this.timer.arm(() => void this.report(), REPORT_DELAY_MS);
  }

  onModuleDestroy(): void {
    this.timer.clear();
  }

  async report(): Promise<void> {
    try {
      const n = await countEmailOnlyAccounts(this.prisma);
      this.logger.log(
        `Входят на сайт только по почте (нет VK ID, Яндекс ID, Telegram, MAX): ${n}`,
      );
    } catch (err) {
      this.logger.warn(`не посчитано: ${(err as Error).message}`);
    }
  }
}
