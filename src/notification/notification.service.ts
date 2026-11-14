import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  encryptPayload,
  decryptPayload,
  sentNow,
  cancelledNow,
} from './notification-payload.crypto';
import { PROACTIVE_TYPES, type NotificationType } from './notification.types';
import { claimForSend } from './notification-claim';
import {
  replacePending,
  swapReminder,
  type ReminderStandIn,
} from './replace-pending';
export {
  PROACTIVE_TYPES,
  QUIET_EXEMPT_TYPES,
  BREAK_TYPES,
  type NotificationType,
} from './notification.types';

export interface DueNotification {
  id: number;
  userId: bigint;
  type: string;
  payload: unknown;
  sendAt: Date;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Запланировать уведомление; payload шифруется (аудит 2026-10, T1). */
  async schedule(u: bigint, t: NotificationType, at: Date, p?: object) {
    await this.prisma.scheduledNotification.create({
      data: { userId: u, type: t, sendAt: at, payload: encryptPayload(p) },
    });
  }

  /** Снять стоящие этого типа и поставить новое — атомарно (replace-pending.ts). */
  replacePending(u: bigint, t: NotificationType, at: Date, payload?: object) {
    return replacePending(this.prisma, u, t, at, payload);
  }

  /** Снять напоминание и поставить вместо него сообщение дня — тем же локом. */
  swapReminder(u: bigint, t: ReminderStandIn, at: Date, payload?: object) {
    return swapReminder(this.prisma, u, t, at, payload);
  }

  /** Отменить все неотправленные уведомления пользователя данного типа */
  async cancel(userId: bigint, type: NotificationType) {
    await this.prisma.scheduledNotification.updateMany({
      where: { userId, type, sentAt: null, cancelledAt: null },
      data: cancelledNow(),
    });
  }

  /** Получить все уведомления которые пора отправить */
  async getDue(): Promise<DueNotification[]> {
    const rows = await this.prisma.scheduledNotification.findMany({
      where: { sendAt: { lte: new Date() }, sentAt: null, cancelledAt: null },
      orderBy: { sendAt: 'asc' },
      take: 500, // M3: бэклог после даунтайма дренируется батчами, старейшие первыми
    });
    return rows.map((r) => ({ ...r, payload: decryptPayload(r.payload) }));
  }

  /** Забрать строку перед отправкой — её не пошлёт второй прогон (backend#15). */
  claim(id: number): Promise<boolean> {
    return claimForSend(this.prisma, id);
  }

  /** Отпустить захват: строка осталась на повтор, следующий тик её возьмёт. */
  async releaseClaim(id: number) {
    await this.prisma.scheduledNotification.updateMany({
      where: { id, sentAt: null },
      data: { attemptedAt: null },
    });
  }

  /** Пометить отправленным. updateMany: строки нет — не бросает, двойной вызов цел. */
  async markSent(id: number) {
    await this.prisma.scheduledNotification.updateMany({
      where: { id, sentAt: null },
      data: sentNow(),
    });
  }

  /** Есть ли уже запланированное неотправленное уведомление данного типа */
  async hasPending(userId: bigint, type: NotificationType): Promise<boolean> {
    const count = await this.prisma.scheduledNotification.count({
      where: { userId, type, sentAt: null, cancelledAt: null },
    });
    return count > 0;
  }

  /** True если уведомление данного типа уже было отправлено или стоит в очереди (включая отменённые) */
  async hasEver(userId: bigint, type: NotificationType): Promise<boolean> {
    const count = await this.prisma.scheduledNotification.count({
      where: { userId, type },
    });
    return count > 0;
  }

  /** Отменить все pending уведомления пользователя (при деактивации) */
  async cancelAll(userId: bigint) {
    await this.prisma.scheduledNotification.updateMany({
      where: { userId, sentAt: null, cancelledAt: null },
      data: cancelledNow(),
    });
  }

  /** Отменить все pending ПРОАКТИВНЫЕ уведомления (при паузе). Терапевтские и summary остаются. */
  async cancelProactive(userId: bigint) {
    await this.prisma.scheduledNotification.updateMany({
      where: {
        userId,
        type: { in: PROACTIVE_TYPES },
        sentAt: null,
        cancelledAt: null,
      },
      data: cancelledNow(),
    });
  }

  /** Снять неотправленные этих типов; с `before` — только стоящие раньше него
   *  (заполнение снимает напоминание на сегодня, завтрашнее остаётся — E13). */
  async cancelTypes(userId: bigint, types: NotificationType[], before?: Date) {
    await this.prisma.scheduledNotification.updateMany({
      where: {
        userId,
        type: { in: types },
        sentAt: null,
        cancelledAt: null,
        ...(before && { sendAt: { lt: before } }),
      },
      data: cancelledNow(),
    });
  }

  /**
   * Сколько проактивных занимают местный день [start, end): уже отправленные в
   * нём и ещё стоящие в очереди на него. Дневной бюджет (R5) —
   * notification.budget.ts; `exceptId` — сама проверяемая строка очереди.
   */
  countProactiveInDay(
    userId: bigint,
    start: Date,
    end: Date,
    exceptId?: number,
  ): Promise<number> {
    return this.prisma.scheduledNotification.count({
      where: {
        userId,
        type: { in: PROACTIVE_TYPES },
        cancelledAt: null,
        ...(exceptId !== undefined && { id: { not: exceptId } }),
        OR: [
          { AND: [{ sentAt: { gte: start } }, { sentAt: { lt: end } }] },
          { sentAt: null, sendAt: { lt: end } },
        ],
      },
    });
  }

  /** Когда последний раз реально отправлялось уведомление данного типа */
  async lastSentAt(
    userId: bigint,
    type: NotificationType,
  ): Promise<Date | null> {
    const row = await this.prisma.scheduledNotification.findFirst({
      where: { userId, type, sentAt: { not: null } },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    return row?.sentAt ?? null;
  }

  /** Снять уведомление, которое некому доставить (нет входа в Telegram). Не
   *  markSent: на sentAt (lastSentAt) стоит каденс — расписание бы сдвинулось. */
  async cancelOne(id: number) {
    await this.prisma.scheduledNotification.updateMany({
      where: { id, sentAt: null, cancelledAt: null },
      data: cancelledNow(),
    });
  }

  /** Перенести неотправленное уведомление на другое время (тихие часы) */
  async defer(id: number, sendAt: Date) {
    await this.prisma.scheduledNotification.updateMany({
      where: { id, sentAt: null },
      data: { sendAt },
    });
  }
}
