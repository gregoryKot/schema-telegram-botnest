import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Leader-election для кронов. Расписание одинаковое на всех инстансах, поэтому
// второй под (масштабирование, перекатывающийся деплой) отрабатывает тот же
// тик: подписчики канала получают два одинаковых поста, пользователь — два
// одинаковых напоминания. Локальные защиты вроде флага isProcessing тут не
// помогают — они внутрипроцессные и о соседнем процессе не знают.
//
// Механика — аренда строкой в БД, а не session-level advisory lock: Prisma
// ходит через пул, и разблокировка легко уедет на другое соединение, а
// транзакционный advisory-lock держал бы транзакцию открытой всё время
// прогона (полуночный планировщик обходит всех пользователей). Аренда —
// один атомарный запрос, переживает падение процесса без «зависшего» лока:
// окно просто истекает.

/** Кто отработал — для разбора «почему тик пропущен» видно в самой строке. */
const INSTANCE_ID =
  process.env.HOSTNAME?.trim() || `pid-${process.pid}-${randomBytes(3).toString('hex')}`;

/**
 * Окно аренды: «этот крон уже отработал за последние N мс — не повторять».
 * Всегда меньше периода самого крона, иначе тик пропускался бы штатно.
 */
export const LEASE_WINDOW = {
  everyMinute: 45_000,
  fiveMinutes: 4 * 60_000,
  hourly: 50 * 60_000,
  daily: 23 * 3_600_000,
} as const;

@Injectable()
export class CronLeaderService {
  private readonly logger = new Logger(CronLeaderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Забрать прогон крона себе. `true` — этот инстанс лидер и обязан отработать,
   * `false` — тик уже забрал кто-то другой, тело крона пропускается.
   *
   * Один запрос: вставка при первом в жизни прогоне, иначе обновление строки
   * с условием «предыдущий прогон старше окна». В Postgres это атомарно —
   * из двух инстансов строку получает ровно один, второй увидит 0 строк.
   */
  async claimRun(name: string, windowMs: number, now = new Date()) {
    const notAfter = new Date(now.getTime() - windowMs);
    try {
      const claimed = await this.prisma.$executeRaw`
        INSERT INTO "CronLease" ("name", "runAt", "instanceId")
        VALUES (${name}, ${now}, ${INSTANCE_ID})
        ON CONFLICT ("name") DO UPDATE
          SET "runAt" = ${now}, "instanceId" = ${INSTANCE_ID}
          WHERE "CronLease"."runAt" <= ${notAfter}
      `;
      return claimed > 0;
    } catch (err) {
      // БД недоступна: тело крона всё равно ходит в неё и упало бы следом,
      // поэтому пропускаем тик, а не рискуем дублем. Warn, а не error —
      // error ушёл бы в AlertLogger и на каждом тике будил админа DM.
      this.logger.warn(
        `claimRun(${name}) не удался, тик пропущен: ${(err as Error)?.message?.slice(0, 120)}`,
      );
      return false;
    }
  }
}
