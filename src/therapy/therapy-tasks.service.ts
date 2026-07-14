import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { encrypt, decrypt } from '../utils/crypto';
import { localDate, localMidnightUTC } from '../utils/tz';

// Задачи пользователя (свои и назначенные терапевтом): создание, список,
// завершение, стрик-прогресс и уведомление о назначении. Терапевтские
// обзоры по всем/одному клиенту — в therapy-tasks-view.service.ts (он
// зовёт getStreakProgress отсюда, не дублируя расчёт).
@Injectable()
export class TherapyTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async createTask(
    userId: bigint,
    body: {
      type: string;
      text: string;
      targetDays?: number;
      needId?: string;
      dueDate?: string;
    },
    assignedBy?: bigint,
  ) {
    const task = await this.prisma.userTask.create({
      data: {
        userId,
        assignedBy: assignedBy ?? null,
        type: body.type,
        text: encrypt(body.text) ?? body.text,
        targetDays: body.targetDays ?? null,
        needId: body.needId ?? null,
        dueDate: body.dueDate ?? null,
      },
    });
    return { ...task, text: body.text }; // return plaintext to caller
  }

  async getTasks(userId: bigint) {
    const now = new Date();
    const uid = userId;

    // Use user's stored timezone for correct "today" across all timezones
    const settings = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { notifyTimezone: true },
    });
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const today = localDate(tz, now);
    const startOfDay = localMidnightUTC(today, tz);

    const tasks = await this.prisma.userTask.findMany({
      where: { userId: uid, done: null },
      orderBy: { createdAt: 'desc' },
    });

    // Cache today's tracker/diary counts to avoid repeating per-task
    const [trackerToday, diaryToday] = await Promise.all([
      this.prisma.rating.count({ where: { userId: uid, date: today } }),
      Promise.all([
        this.prisma.schemaDiaryEntry.count({
          where: { userId: uid, createdAt: { gte: startOfDay } },
        }),
        this.prisma.modeDiaryEntry.count({
          where: { userId: uid, createdAt: { gte: startOfDay } },
        }),
        this.prisma.gratitudeDiaryEntry.count({
          where: { userId: uid, date: today },
        }),
      ]).then(([s, m, g]) => s + m + g),
    ]);

    // Auto-expire overdue streak tasks
    const expired = tasks.filter(
      (t) =>
        t.targetDays &&
        Math.floor((now.getTime() - t.createdAt.getTime()) / 86_400_000) >=
          t.targetDays,
    );
    if (expired.length > 0) {
      await Promise.all(
        expired.map((t) =>
          this.prisma.userTask.update({
            where: { id: t.id },
            data: { done: false, completedAt: now },
          }),
        ),
      );
    }
    const expiredIds = new Set(expired.map((t) => t.id));

    const STREAK_TYPES = new Set([
      'tracker_streak',
      'diary_streak',
      'schema_diary',
      'mode_diary',
    ]);
    const activeTasks = tasks.filter((t) => !expiredIds.has(t.id));

    return Promise.all(
      activeTasks.map(async (task) => {
        const doneToday =
          task.type === 'tracker_streak'
            ? trackerToday > 0
            : task.type === 'diary_streak'
              ? diaryToday > 0
              : undefined;
        const progress =
          task.targetDays && STREAK_TYPES.has(task.type)
            ? await this.getStreakProgress(userId, task.type, task.targetDays)
            : undefined;
        return {
          ...task,
          text: decrypt(task.text) ?? task.text,
          userId: Number(uid),
          assignedBy: task.assignedBy ? Number(task.assignedBy) : null,
          doneToday,
          progress,
        };
      }),
    );
  }

  async getTaskHistory(userId: bigint) {
    const rows = await this.prisma.userTask.findMany({
      where: { userId, done: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => ({ ...r, text: decrypt(r.text) ?? r.text }));
  }

  async completeTask(
    userId: bigint,
    taskId: number,
    done: boolean,
  ): Promise<boolean> {
    const result = await this.prisma.userTask.updateMany({
      where: { id: taskId, userId },
      data: { done, completedAt: new Date() },
    });
    return result.count > 0;
  }

  async checkStreakTasks(userId: bigint): Promise<void> {
    const tasks = await this.prisma.userTask.findMany({
      where: {
        userId,
        done: null,
        type: {
          in: ['diary_streak', 'tracker_streak', 'schema_diary', 'mode_diary'],
        },
      },
    });
    if (tasks.length === 0) return;
    const now = new Date();
    const progresses = await Promise.all(
      tasks.map((t) =>
        this.getStreakProgress(userId, t.type, t.targetDays ?? 7),
      ),
    );
    const completed = tasks.filter(
      (t, i) => progresses[i] >= (t.targetDays ?? 7),
    );
    if (completed.length > 0) {
      await Promise.all(
        completed.map((t) =>
          this.prisma.userTask.update({
            where: { id: t.id },
            data: { done: true, completedAt: now },
          }),
        ),
      );
    }
  }

  async getStreakProgress(
    userId: bigint,
    type: string,
    days: number,
  ): Promise<number> {
    const since = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (type === 'tracker_streak') {
      const dates = await this.prisma.rating.groupBy({
        by: ['date'],
        where: { userId, date: { gte: since } },
      });
      return dates.length;
    }
    if (type === 'schema_diary') {
      return this.prisma.schemaDiaryEntry.count({
        where: { userId, createdAt: { gte: new Date(since) } },
      });
    }
    if (type === 'mode_diary') {
      return this.prisma.modeDiaryEntry.count({
        where: { userId, createdAt: { gte: new Date(since) } },
      });
    }
    // diary_streak: any diary entry (schema or mode or gratitude)
    const [schema, mode, gratitude] = await Promise.all([
      this.prisma.schemaDiaryEntry.groupBy({
        by: ['createdAt'],
        where: { userId, createdAt: { gte: new Date(since) } },
      }),
      this.prisma.modeDiaryEntry.groupBy({
        by: ['createdAt'],
        where: { userId, createdAt: { gte: new Date(since) } },
      }),
      this.prisma.gratitudeDiaryEntry.findMany({
        where: { userId, date: { gte: since } },
        select: { date: true },
      }),
    ]);
    const diaryDates = new Set([
      ...schema.map((e) => e.createdAt.toISOString().slice(0, 10)),
      ...mode.map((e) => e.createdAt.toISOString().slice(0, 10)),
      ...gratitude.map((e) => e.date),
    ]);
    return diaryDates.size;
  }

  async scheduleTaskNotification(
    clientId: bigint,
    task: { text: string; needId: string | null; dueDate: string | null },
  ): Promise<void> {
    await this.notificationService.schedule(
      clientId,
      'task_assigned',
      new Date(),
      {
        text: task.text,
        needId: task.needId,
        dueDate: task.dueDate,
      },
    );
  }
}
