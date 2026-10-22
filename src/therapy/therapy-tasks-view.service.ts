import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../utils/crypto';
import { localDate, localMidnightUTC } from '../utils/tz';
import { TherapyTasksService } from './therapy-tasks.service';
import { TherapyRelationsService } from './therapy-relations.service';

// Терапевтский обзор задач: по всем клиентам сразу и по одному конкретному
// клиенту. Стрик-прогресс не пересчитывается заново — берётся из
// TherapyTasksService.getStreakProgress (та же формула, что и в /tasks
// самого клиента).
@Injectable()
export class TherapyTasksViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TherapyTasksService,
    private readonly relationsService: TherapyRelationsService,
  ) {}

  async getAllTasksForTherapist(therapistId: bigint) {
    const relations = await this.prisma.therapyRelation.findMany({
      where: { therapistId, status: 'active' },
      include: { client: { select: { id: true, firstName: true } } },
    });

    // Точный userId связи: реальный клиент — rel.client.id, виртуальный —
    // -rel.id (см. getTasksForClient). Общий helper — для запроса ниже
    // и для группировки результата по конкретной связи.
    const userIdOf = (rel: (typeof relations)[number]) =>
      rel.client ? rel.client.id : -BigInt(rel.id);

    // Один запрос по всем userId вместо findMany в цикле — было N+1 (D2).
    // Группировка по точному userId (не userId: { lt: 0 }, который матчил
    // ВСЕХ виртуальных клиентов терапевта разом и путал их задачи, O2).
    const allTasks = await this.prisma.userTask.findMany({
      where: {
        assignedBy: therapistId,
        userId: { in: relations.map(userIdOf) },
      },
      orderBy: { createdAt: 'desc' },
    });

    const tasksByUserId = new Map<string, typeof allTasks>();
    for (const t of allTasks) {
      const key = String(t.userId);
      const group = tasksByUserId.get(key);
      if (group) group.push(t);
      else tasksByUserId.set(key, [t]);
    }

    const results: Array<{
      clientId: bigint;
      clientName: string;
      tasks: Record<string, unknown>[];
    }> = [];

    for (const rel of relations) {
      const clientId = userIdOf(rel);
      // clientAlias и virtualClientName лежат зашифрованными (PII) — без
      // decrypt терапевт увидел бы в кабинете base64 вместо имени (T7).
      const alias = decrypt(rel.clientAlias);
      const clientName = rel.client
        ? (alias ?? rel.client.firstName ?? `ID ${clientId}`)
        : (alias ?? decrypt(rel.virtualClientName) ?? `ID ${-clientId}`);
      const tasks = tasksByUserId.get(String(userIdOf(rel))) ?? [];

      if (tasks.length > 0) {
        results.push({
          clientId,
          clientName,
          tasks: tasks.map((t) => ({
            ...t,
            text: decrypt(t.text) ?? t.text,
            userId: clientId,
            assignedBy: therapistId,
          })),
        });
      }
    }

    return results;
  }

  async getTasksForClient(therapistId: bigint, clientId: bigint) {
    // Одна граница доступа на весь therapy-контур (в том числе виртуальная
    // ветка с clientId: null, T4) — своей копии проверки здесь нет. Нет связи
    // → null, контроллер отвечает 403.
    try {
      await this.relationsService.assertHasClient(therapistId, clientId);
    } catch (e) {
      if (e instanceof Error && e.message === 'No active relation') return null;
      throw e;
    }
    if (clientId < 0n) {
      const tasks = await this.prisma.userTask.findMany({
        where: { userId: clientId, assignedBy: therapistId },
        orderBy: { createdAt: 'desc' },
      });
      return tasks.map((task) => ({
        ...task,
        text: decrypt(task.text) ?? task.text,
        userId: clientId,
        assignedBy: therapistId,
        doneToday: undefined,
        progress: undefined,
      }));
    }
    const uid = clientId;
    const now = new Date();
    const settings = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { notifyTimezone: true },
    });
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const today = localDate(tz, now);
    const startOfDay = localMidnightUTC(today, tz);

    const tasks = await this.prisma.userTask.findMany({
      where: { userId: uid, assignedBy: therapistId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      tasks.map(async (task) => {
        let doneToday: boolean | undefined;
        let progress: number | undefined;
        if (task.type === 'tracker_streak') {
          doneToday = await this.prisma.rating
            .count({ where: { userId: uid, date: today } })
            .then((c) => c > 0);
        } else if (task.type === 'diary_streak') {
          const [s, m, g] = await Promise.all([
            this.prisma.schemaDiaryEntry.count({
              where: { userId: uid, createdAt: { gte: startOfDay } },
            }),
            this.prisma.modeDiaryEntry.count({
              where: { userId: uid, createdAt: { gte: startOfDay } },
            }),
            this.prisma.gratitudeDiaryEntry.count({
              where: { userId: uid, date: today },
            }),
          ]);
          doneToday = s + m + g > 0;
        }
        if (
          task.targetDays &&
          [
            'tracker_streak',
            'diary_streak',
            'schema_diary',
            'mode_diary',
          ].includes(task.type)
        ) {
          progress = await this.tasksService.getStreakProgress(
            uid,
            task.type,
            task.targetDays,
          );
        }
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
}
