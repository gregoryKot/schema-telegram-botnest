import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { NotificationService } from '../notification/notification.service';
import { MINIAPP_URL } from '../telegram/telegram.constants';

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export interface TherapyRelationInfo {
  role: 'therapist' | 'client';
  status: string;
  partnerName: string | null;
  partnerId: number | null;
  code: string;
}

export interface TherapyClientSummary {
  telegramId: number;
  name: string | null;
  streak: number;
  lastActiveDate: string | null;
  todayIndex: number | null;
}

@Injectable()
export class TherapyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── Connection ─────────────────────────────────────────────────────────────

  async createInvite(therapistId: number): Promise<{ code: string; url: string }> {
    let code: string;
    do { code = randomCode(); } while (await this.prisma.therapyRelation.findUnique({ where: { code } }));
    await this.prisma.therapyRelation.create({ data: { therapistId: BigInt(therapistId), code } });
    return { code, url: `${MINIAPP_URL}?startapp=therapy_${code}` };
  }

  async joinAsClient(clientId: number, code: string): Promise<boolean> {
    const rel = await this.prisma.therapyRelation.findUnique({ where: { code: code.toUpperCase() } });
    if (!rel || rel.status !== 'pending' || rel.clientId !== null) return false;
    if (rel.therapistId === BigInt(clientId)) return false;
    await this.prisma.therapyRelation.update({
      where: { id: rel.id },
      data: { clientId: BigInt(clientId), status: 'active' },
    });
    return true;
  }

  async getRelation(userId: number): Promise<TherapyRelationInfo | null> {
    const uid = BigInt(userId);
    const asTherapist = await this.prisma.therapyRelation.findFirst({
      where: { therapistId: uid, status: 'active' },
      include: { client: { select: { firstName: true } } },
    });
    if (asTherapist) {
      return { role: 'therapist', status: 'active', partnerName: asTherapist.client?.firstName ?? null, partnerId: asTherapist.clientId ? Number(asTherapist.clientId) : null, code: asTherapist.code };
    }
    const asClient = await this.prisma.therapyRelation.findFirst({
      where: { clientId: uid, status: 'active' },
      include: { therapist: { select: { id: true, firstName: true } } },
    });
    if (asClient) {
      return { role: 'client', status: 'active', partnerName: asClient.therapist?.firstName ?? null, partnerId: asClient.therapist ? Number(asClient.therapist.id) : null, code: asClient.code };
    }
    return null;
  }

  async disconnect(userId: number): Promise<void> {
    const uid = BigInt(userId);
    await this.prisma.therapyRelation.deleteMany({
      where: { OR: [{ therapistId: uid }, { clientId: uid }] },
    });
  }

  async getClients(therapistId: number): Promise<TherapyClientSummary[]> {
    const relations = await this.prisma.therapyRelation.findMany({
      where: { therapistId: BigInt(therapistId), status: 'active' },
      include: { client: { select: { id: true, firstName: true } } },
    });
    const results: TherapyClientSummary[] = [];
    for (const rel of relations) {
      if (!rel.client) continue;
      const clientId = Number(rel.client.id);
      const streak = await this.analyticsService.getConsecutiveDays(clientId);
      const daysSince = await this.analyticsService.getDaysSinceLastFill(clientId);
      const lastActiveDate = daysSince >= 0 ? new Date(Date.now() - daysSince * 86400000).toISOString().slice(0, 10) : null;
      const history = await this.analyticsService.getHistoryRatings(clientId, 1);
      const todayRatings = history[0]?.ratings;
      const todayValues = todayRatings ? Object.values(todayRatings) : [];
      const todayIndex = todayValues.length === 5
        ? Math.round(todayValues.reduce((s, v) => s + v, 0) / 5 * 10) / 10
        : null;
      results.push({ telegramId: clientId, name: rel.client.firstName, streak, lastActiveDate, todayIndex });
    }
    return results;
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  async createTask(userId: number, body: {
    type: string; text: string; targetDays?: number;
    needId?: string; dueDate?: string;
  }, assignedBy?: number) {
    return this.prisma.userTask.create({
      data: {
        userId: BigInt(userId),
        assignedBy: assignedBy ? BigInt(assignedBy) : null,
        type: body.type,
        text: body.text,
        targetDays: body.targetDays ?? null,
        needId: body.needId ?? null,
        dueDate: body.dueDate ?? null,
      },
    });
  }

  async getTasks(userId: number) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const uid = BigInt(userId);

    const tasks = await this.prisma.userTask.findMany({
      where: { userId: uid, done: null },
      orderBy: { createdAt: 'desc' },
    });

    const result: any[] = [];
    for (const task of tasks) {
      // Auto-expire streak tasks that have run out of days
      if (task.targetDays) {
        const daysElapsed = Math.floor((now.getTime() - task.createdAt.getTime()) / 86_400_000);
        if (daysElapsed >= task.targetDays) {
          await this.prisma.userTask.update({ where: { id: task.id }, data: { done: false, completedAt: now } });
          continue;
        }
      }

      let doneToday: boolean | undefined;
      if (task.type === 'tracker_streak') {
        const c = await this.prisma.rating.count({ where: { userId: uid, date: today } });
        doneToday = c > 0;
      } else if (task.type === 'diary_streak') {
        const startOfDay = new Date(today + 'T00:00:00.000Z');
        const [s, m, g] = await Promise.all([
          this.prisma.schemaDiaryEntry.count({ where: { userId: uid, createdAt: { gte: startOfDay } } }),
          this.prisma.modeDiaryEntry.count({ where: { userId: uid, createdAt: { gte: startOfDay } } }),
          this.prisma.gratitudeDiaryEntry.count({ where: { userId: uid, date: today } }),
        ]);
        doneToday = s + m + g > 0;
      }

      result.push({ ...task, userId: Number(uid), assignedBy: task.assignedBy ? Number(task.assignedBy) : null, doneToday });
    }
    return result;
  }

  async getTaskHistory(userId: number) {
    return this.prisma.userTask.findMany({
      where: { userId: BigInt(userId), done: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 30,
    });
  }

  async getTasksForClient(therapistId: number, clientId: number) {
    // Verify relation
    const rel = await this.prisma.therapyRelation.findFirst({
      where: { therapistId: BigInt(therapistId), clientId: BigInt(clientId), status: 'active' },
    });
    if (!rel) return null;
    return this.prisma.userTask.findMany({
      where: { userId: BigInt(clientId), assignedBy: BigInt(therapistId) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async completeTask(userId: number, taskId: number, done: boolean): Promise<void> {
    await this.prisma.userTask.updateMany({
      where: { id: taskId, userId: BigInt(userId) },
      data: { done, completedAt: new Date() },
    });
  }

  async checkStreakTasks(userId: number): Promise<void> {
    const tasks = await this.prisma.userTask.findMany({
      where: { userId: BigInt(userId), done: null, type: { in: ['diary_streak', 'tracker_streak', 'schema_diary', 'mode_diary'] } },
    });
    if (tasks.length === 0) return;
    const now = new Date();
    for (const task of tasks) {
      const days = task.targetDays ?? 7;
      const progress = await this.getStreakProgress(userId, task.type, days);
      if (progress >= days) {
        await this.prisma.userTask.update({ where: { id: task.id }, data: { done: true, completedAt: now } });
      }
    }
  }

  async getStreakProgress(userId: number, type: string, days: number): Promise<number> {
    const uid = BigInt(userId);
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    if (type === 'tracker_streak') {
      const dates = await this.prisma.rating.groupBy({ by: ['date'], where: { userId: uid, date: { gte: since } } });
      return dates.length;
    }
    if (type === 'schema_diary') {
      return this.prisma.schemaDiaryEntry.count({ where: { userId: uid, createdAt: { gte: new Date(since) } } });
    }
    if (type === 'mode_diary') {
      return this.prisma.modeDiaryEntry.count({ where: { userId: uid, createdAt: { gte: new Date(since) } } });
    }
    // diary_streak: any diary entry (schema or mode or gratitude)
    const [schema, mode, gratitude] = await Promise.all([
      this.prisma.schemaDiaryEntry.groupBy({ by: ['createdAt'], where: { userId: uid, createdAt: { gte: new Date(since) } } }),
      this.prisma.modeDiaryEntry.groupBy({ by: ['createdAt'], where: { userId: uid, createdAt: { gte: new Date(since) } } }),
      this.prisma.gratitudeDiaryEntry.findMany({ where: { userId: uid, date: { gte: since } }, select: { date: true } }),
    ]);
    const diaryDates = new Set([
      ...schema.map(e => e.createdAt.toISOString().slice(0, 10)),
      ...mode.map(e => e.createdAt.toISOString().slice(0, 10)),
      ...gratitude.map(e => e.date),
    ]);
    return diaryDates.size;
  }

  async scheduleTaskNotification(clientId: number, task: { text: string; needId: string | null; dueDate: string | null }): Promise<void> {
    await this.notificationService.schedule(clientId, 'task_assigned', new Date(), {
      text: task.text, needId: task.needId, dueDate: task.dueDate,
    });
  }
}
