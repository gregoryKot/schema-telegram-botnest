import { Injectable } from '@nestjs/common';
import { taskNotificationTitle, TaskNotificationInput } from './task-title';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { encrypt, decrypt } from '../utils/crypto';
import { localDate, localMidnightUTC } from '../utils/tz';
import { completeOfflineTask, deleteAssignedTask } from './assigned-task';
import { streakProgress } from './streak-progress';
import { STREAK_TASK_TYPES, tracksStreakProgress } from './streak-window';
import { closeExpiredStreaks } from './streak-expire';

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
    const tz = await this.clientTimezone(uid);
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

    // Срок серии вышел — по календарю клиента; то же закрытие у психолога
    const activeTasks = (
      await closeExpiredStreaks(this.prisma, tasks, tz, now)
    ).filter((t) => t.done === null);

    return Promise.all(
      activeTasks.map(async (task) => {
        const doneToday =
          task.type === 'tracker_streak'
            ? trackerToday > 0
            : task.type === 'diary_streak'
              ? diaryToday > 0
              : undefined;
        const progress = tracksStreakProgress(task)
          ? await this.getStreakProgress(userId, task, tz)
          : undefined;
        return {
          ...task,
          text: decrypt(task.text) ?? task.text,
          userId: uid,
          assignedBy: task.assignedBy ?? null,
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

  /** Терапевт: удалить своё задание текущему клиенту (assigned-task.ts). */
  deleteAssignedTask(therapistId: bigint, taskId: number): Promise<boolean> {
    return deleteAssignedTask(this.prisma, therapistId, taskId);
  }

  /** Терапевт: закрыть задание офлайн-клиента (assigned-task.ts). */
  completeOfflineTask(
    therapistId: bigint,
    taskId: number,
    done: boolean,
  ): Promise<boolean> {
    return completeOfflineTask(this.prisma, therapistId, taskId, done);
  }

  async checkStreakTasks(userId: bigint): Promise<void> {
    const tasks = await this.prisma.userTask.findMany({
      where: { userId, done: null, type: { in: [...STREAK_TASK_TYPES] } },
    });
    if (tasks.length === 0) return;
    const now = new Date();
    const tz = await this.clientTimezone(userId);
    const progresses = await Promise.all(
      tasks.map((t) => this.getStreakProgress(userId, t, tz)),
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

  /** notifyTimezone клиента: в его днях лежат оценки и считаются серии. */
  async clientTimezone(userId: bigint): Promise<string> {
    const settings = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifyTimezone: true },
    });
    return settings?.notifyTimezone ?? 'Europe/Moscow';
  }

  /** Дни серии в её окне по календарю клиента (streak-progress.ts). */
  getStreakProgress(
    userId: bigint,
    task: Parameters<typeof streakProgress>[2],
    tz: string,
  ): Promise<number> {
    return streakProgress(this.prisma, userId, task, tz);
  }

  async scheduleTaskNotification(
    clientId: bigint,
    task: TaskNotificationInput,
  ): Promise<void> {
    await this.notificationService.schedule(
      clientId,
      'task_assigned',
      new Date(),
      {
        text: taskNotificationTitle(task.type, task.text),
        needId: task.needId,
        dueDate: task.dueDate,
        taskId: task.taskId,
      },
    );
  }
}
