import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Отметка «прогон дошёл до конца» у аренды крона (`CronLease.doneRunAt`).
// Аренда берётся ДО обхода: полуночный планировщик, оборванный
// деплоем посреди цикла по пользователям, оставлял хвост без напоминаний на
// сутки, а catch-up нового процесса упирался в свежую аренду и молча выходил
// (аудит 2026-10). Теперь прогон, захваченный в runAt, помечается
// `doneRunAt = runAt` только когда цикл прошёл до конца; рестарт видит
// незавершённый прогон и доделывает его, проба cronLeases (cron-lease-done.ts)
// краснеет, если не доделал никто.
//
// Базовый класс CronLeaderService (наследование, а не второй провайдер): кроны
// и так получают арендодателя из глобального CronLeaderModule, и отметка
// завершения живёт рядом с захватом — на той же строке той же таблицы.
// Типизированная Prisma, не сырой SQL: атомарность тут не нужна — пишет тот,
// кто прогон закончил, а условие по runAt не даёт пометить чужой, более новый.
@Injectable()
export class CronRunLedger {
  constructor(protected readonly prisma: PrismaService) {}

  /** Прогон, захваченный в `runAt`, дошёл до конца. Аренду уже перехватил
   * более новый прогон — строка не трогается: его отметку ставит он сам. */
  async finishRun(name: string, runAt: Date): Promise<void> {
    await this.prisma.cronLease.updateMany({
      where: { name, runAt },
      data: { doneRunAt: runAt },
    });
  }

  /** `runAt` прогона, который начат внутри окна и не дошёл до конца, иначе
   * null. Старше окна — не доделка, а новый прогон: его заберёт `claimRun`. */
  async unfinishedRun(
    name: string,
    windowMs: number,
    now = new Date(),
  ): Promise<Date | null> {
    const row = await this.prisma.cronLease.findUnique({
      where: { name },
      select: { runAt: true, doneRunAt: true },
    });
    if (!row || row.doneRunAt?.getTime() === row.runAt.getTime()) return null;
    return now.getTime() - row.runAt.getTime() < windowMs ? row.runAt : null;
  }
}
