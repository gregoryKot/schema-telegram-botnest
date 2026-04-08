import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'reminder'
  | 'pre_reminder'
  | 'summary'
  | 'onboarding_1'
  | 'onboarding_3'
  | 'onboarding_7'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'lapsing_2'
  | 'lapsing_4'
  | 'dormant_7'
  | 'reengagement_30'
  | 'weekly'
  | 'anniversary_30'
  | 'anniversary_60'
  | 'anniversary_90'
  | 'practice_reminder'
  | 'practice_missed'
  | 'low_streak_insight'
  | 'nudge'
  | 'task_assigned'
  | 'ysq_requested';

export interface DueNotification {
  id: number;
  userId: number;
  type: string;
  payload: unknown;
  sendAt: Date;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Запланировать уведомление */
  async schedule(userId: number, type: NotificationType, sendAt: Date, payload?: object) {
    await this.prisma.scheduledNotification.create({
      data: { userId: BigInt(userId), type, sendAt, payload: payload ?? undefined },
    });
  }

  /** Отменить все неотправленные уведомления пользователя данного типа */
  async cancel(userId: number, type: NotificationType) {
    await this.prisma.scheduledNotification.updateMany({
      where: { userId: BigInt(userId), type, sentAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
  }

  /** Получить все уведомления которые пора отправить */
  async getDue(): Promise<DueNotification[]> {
    const rows = await this.prisma.scheduledNotification.findMany({
      where: { sendAt: { lte: new Date() }, sentAt: null, cancelledAt: null },
      orderBy: { sendAt: 'asc' },
    });
    return rows.map((r) => ({ ...r, userId: Number(r.userId) }));
  }

  /** Пометить уведомление как отправленное */
  async markSent(id: number) {
    await this.prisma.scheduledNotification.update({
      where: { id },
      data: { sentAt: new Date() },
    });
  }

  /** Есть ли уже запланированное неотправленное уведомление данного типа */
  async hasPending(userId: number, type: NotificationType): Promise<boolean> {
    const count = await this.prisma.scheduledNotification.count({
      where: { userId: BigInt(userId), type, sentAt: null, cancelledAt: null },
    });
    return count > 0;
  }

  /** True если уведомление данного типа уже было отправлено или стоит в очереди (включая отменённые) */
  async hasEver(userId: number, type: NotificationType): Promise<boolean> {
    const count = await this.prisma.scheduledNotification.count({
      where: { userId: BigInt(userId), type },
    });
    return count > 0;
  }

  /** Отменить все pending уведомления пользователя (при деактивации) */
  async cancelAll(userId: number) {
    await this.prisma.scheduledNotification.updateMany({
      where: { userId: BigInt(userId), sentAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
  }
}
