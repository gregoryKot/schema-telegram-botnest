import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../utils/crypto';
import { localDate, localMidnightUTC } from '../utils/tz';
import { TherapyTasksService } from './therapy-tasks.service';

// Терапевтский обзор задач: по всем клиентам сразу и по одному конкретному
// клиенту. Стрик-прогресс не пересчитывается заново — берётся из
// TherapyTasksService.getStreakProgress (та же формула, что и в /tasks
// самого клиента).
@Injectable()
export class TherapyTasksViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TherapyTasksService,
  ) {}

  async getAllTasksForTherapist(therapistId: bigint) {
    const relations = await this.prisma.therapyRelation.findMany({
      where: { therapistId, status: 'active' },
      include: { client: { select: { id: true, firstName: true } } },
    });

    const results: Array<{
      clientId: number;
      clientName: string;
      tasks: any[];
    }> = [];

    for (const rel of relations) {
      const clientId = rel.client ? Number(rel.client.id) : -rel.id;
      const clientName = rel.client
        ? ((rel as any).clientAlias ?? rel.client.firstName ?? `ID ${clientId}`)
        : ((rel as any).clientAlias ??
          (rel as any).virtualClientName ??
          `ID ${-clientId}`);

      const tasks = await this.prisma.userTask.findMany({
        where: {
          assignedBy: therapistId,
          userId: rel.client ? rel.client.id : { lt: 0 },
        },
        orderBy: { createdAt: 'desc' },
      });

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

  async getTasksForClient(therapistId: bigint, clientId: number) {
    if (clientId < 0) {
      // Virtual client: look up by relation ID
      const rel = await this.prisma.therapyRelation.findFirst({
        where: { id: -clientId, therapistId, status: 'active' },
      });
      if (!rel) return null;
      const tasks = await this.prisma.userTask.findMany({
        where: { userId: BigInt(clientId), assignedBy: therapistId },
        orderBy: { createdAt: 'desc' },
      });
      return tasks.map((task) => ({
        ...task,
        text: decrypt(task.text) ?? task.text,
        userId: clientId,
        assignedBy: Number(therapistId),
        doneToday: undefined,
        progress: undefined,
      }));
    }
    const uid = BigInt(clientId);
    const rel = await this.prisma.therapyRelation.findFirst({
      where: { therapistId, clientId: uid, status: 'active' },
    });
    if (!rel) return null;
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
          userId: Number(uid),
          assignedBy: task.assignedBy ? Number(task.assignedBy) : null,
          doneToday,
          progress,
        };
      }),
    );
  }
}
