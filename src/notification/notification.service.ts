import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptPayload, decryptPayload } from './notification-payload.crypto';
import { PROACTIVE_TYPES, type NotificationType } from './notification.types';
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

  /** Запланировать уведомление */
  async schedule(
    userId: bigint,
    type: NotificationType,
    sendAt: Date,
    payload?: object,
  ) {
    await this.prisma.scheduledNotification.create({
      // Текст задания терапевта и подобное шифруется (аудит 2026-10, T1) —
      // в БД свободный текст открытым не лежит.
      data: {
        userId,
        type,
        sendAt,
        payload: encryptPayload(payload),
      },
    });
  }

  /** Освежить данные неотправленного уведомления — без новой строки (E16). */
  async refreshPending(
    userId: bigint,
    type: NotificationType,
    payload: object,
  ) {
    await this.prisma.scheduledNotification.updateMany({
      where: { userId, type, sentAt: null, cancelledAt: null },
      data: { payload: encryptPayload(payload) },
    });
  }

  /** Отменить все неотправленные уведомления пользователя данного типа */
  async cancel(userId: bigint, type: NotificationType) {
    await this.prisma.scheduledNotification.updateMany({
      where: { userId, type, sentAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
  }

  /** Получить все уведомления которые пора отправить */
  async getDue(): Promise<DueNotification[]> {
    const rows = await this.prisma.scheduledNotification.findMany({
      where: { sendAt: { lte: new Date() }, sentAt: null, cancelledAt: null },
      orderBy: { sendAt: 'asc' },
      take: 500, // M3: бэклог после даунтайма дренируется батчами, старейшие первыми
    });
    return rows.map((r) => ({
      ...r,
      payload: decryptPayload(r.payload),
    }));
  }

  /** Пометить уведомление как отправленное. Идемпотентно — двойной вызов не падает. */
  async markSent(id: number) {
    // updateMany не бросает P2025 если строки уже нет — две конкурентные обработки безопасны.
    await this.prisma.scheduledNotification.updateMany({
      where: { id, sentAt: null },
      data: { sentAt: new Date() },
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
      data: { cancelledAt: new Date() },
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
      data: { cancelledAt: new Date() },
    });
  }

  /**
   * Снять неотправленные уведомления этих типов; с `before` — только те, что
   * стоят раньше этого момента (заполнение снимает напоминание на сегодня, а
   * завтрашнее оставляет — E13, telegram.diary-complete.ts).
   */
  async cancelTypes(userId: bigint, types: NotificationType[], before?: Date) {
    await this.prisma.scheduledNotification.updateMany({
      where: {
        userId,
        type: { in: types },
        sentAt: null,
        cancelledAt: null,
        ...(before && { sendAt: { lt: before } }),
      },
      data: { cancelledAt: new Date() },
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

  /**
   * Снять одно уведомление, которое доставить некому (у аккаунта нет входа в
   * Telegram). Именно cancelledAt, а не markSent: sentAt читает lastSentAt(),
   * на нём стоит каденс — «отправлено» без отправки сдвинуло бы расписание.
   */
  async cancelOne(id: number) {
    await this.prisma.scheduledNotification.updateMany({
      where: { id, sentAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
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
