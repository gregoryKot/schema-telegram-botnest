// Запросы админской аналитики. Без N+1: каждая таблица читается одним
// запросом на всех терапевтов, дальше считают чистые сборщики.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { decrypt } from '../../utils/crypto';
import { localMidnightUTC } from '../../utils/tz';
import { eventsPerDay } from './admin-events-daily';
import { REPORT_TZ, type EventUserCount } from './admin-overview.builders';
import { resolveName, type PersonInfo } from './admin-people.builders';
import type {
  ActionKey,
  ActionStamp,
  ActivityInfo,
  RelationInput,
  TherapistInput,
} from './admin-therapist.builders';

/** Начало первого дня окна (полночь МСК) как момент времени. */
export const windowStart = (firstDate: string): Date =>
  localMidnightUTC(firstDate, REPORT_TZ);

@Injectable()
export class AdminAnalyticsQueries {
  constructor(private readonly prisma: PrismaService) {}

  async activePerDay(from: string, to: string): Promise<Map<string, number>> {
    const rows = await this.prisma.appActivity.groupBy({
      by: ['date'],
      where: { date: { gte: from, lte: to } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.date, r._count._all]));
  }

  /** Сколько разных людей заходило с `from` (включительно). */
  async distinctActiveSince(from: string): Promise<number> {
    const rows = await this.prisma.appActivity.groupBy({
      by: ['userId'],
      where: { date: { gte: from } },
    });
    return rows.length;
  }

  async newUserMoments(since: Date): Promise<Date[]> {
    const rows = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });
    return rows.map((r) => r.createdAt);
  }

  eventsPerDay(since: Date): Promise<Map<string, number>> {
    return eventsPerDay(this.prisma, since);
  }

  /** Пары «событие – человек» с числом действий за окно. */
  async eventsByNameUser(since: Date): Promise<EventUserCount[]> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['name', 'userId'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      name: r.name,
      userId: r.userId,
      count: r._count._all,
    }));
  }

  async totals(): Promise<{
    users: number;
    therapists: number;
    clientsInTherapy: number;
  }> {
    const [users, therapists, clients] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'THERAPIST' } }),
      this.prisma.therapyRelation.groupBy({
        by: ['clientId'],
        where: { status: 'active', clientId: { not: null } },
      }),
    ]);
    return { users, therapists, clientsInTherapy: clients.length };
  }

  /** Заходы в окне и последний заход за всё время — по списку людей. */
  async activityOf(
    ids: bigint[],
    from: string,
  ): Promise<Map<string, ActivityInfo>> {
    if (ids.length === 0) return new Map();
    const [inWindow, last] = await Promise.all([
      this.prisma.appActivity.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, date: { gte: from } },
        _count: { _all: true },
      }),
      this.prisma.appActivity.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _max: { date: true },
      }),
    ]);
    const out = new Map<string, ActivityInfo>();
    for (const r of last) {
      out.set(String(r.userId), {
        activeDays: 0,
        lastActive: r._max.date ?? null,
      });
    }
    for (const r of inWindow) {
      const cur = out.get(String(r.userId));
      if (cur) cur.activeDays = r._count._all;
    }
    return out;
  }

  /** Имя, роль и заходы людей из топа — только счётчики и имя. */
  async peopleInfo(
    ids: bigint[],
    from: string,
  ): Promise<Map<string, PersonInfo>> {
    if (ids.length === 0) return new Map();
    const [users, requests, activity] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, role: true },
      }),
      this.prisma.therapistRequest.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, fullName: true },
      }),
      this.activityOf(ids, from),
    ]);
    const names = requestNames(requests);
    return new Map(
      users.map((u) => {
        const key = String(u.id);
        const act = activity.get(key);
        return [
          key,
          {
            role: u.role === 'THERAPIST' ? 'THERAPIST' : 'CLIENT',
            name: resolveName(names.get(key), u.firstName),
            activeDays: act?.activeDays ?? 0,
            lastActive: act?.lastActive ?? null,
          },
        ];
      }),
    );
  }

  async therapists(): Promise<TherapistInput[]> {
    const users = await this.prisma.user.findMany({
      where: { role: 'THERAPIST' },
      select: { id: true, firstName: true },
    });
    const requests = await this.prisma.therapistRequest.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { userId: true, fullName: true },
    });
    const names = requestNames(requests);
    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      requestName: names.get(String(u.id)) ?? null,
    }));
  }

  relations(ids: bigint[]): Promise<RelationInput[]> {
    return this.prisma.therapyRelation.findMany({
      where: { therapistId: { in: ids } },
      select: {
        therapistId: true,
        status: true,
        clientId: true,
        virtualClientName: true,
      },
    });
  }

  /** Действия терапевтов за окно: только id и момент, без содержимого. */
  async actions(
    ids: bigint[],
    since: Date,
  ): Promise<Record<ActionKey, ActionStamp[]>> {
    const t = { therapistId: { in: ids } };
    const made = { createdAt: { gte: since } };
    const [notes, tasks, planItems, marks, concepts, modes, invites] =
      await Promise.all([
        this.prisma.therapistNote.findMany({
          where: { ...t, ...made },
          select: { therapistId: true, createdAt: true },
        }),
        this.prisma.userTask.findMany({
          where: { assignedBy: { in: ids }, ...made },
          select: { assignedBy: true, createdAt: true },
        }),
        this.prisma.therapyPlanItem.findMany({
          where: { ...t, ...made },
          select: { therapistId: true, createdAt: true },
        }),
        this.prisma.guideMark.findMany({
          where: { ...t, ...made },
          select: { therapistId: true, createdAt: true },
        }),
        this.prisma.clientConceptualization.findMany({
          where: { ...t, updatedAt: { gte: since } },
          select: { therapistId: true, updatedAt: true },
        }),
        this.prisma.therapistCustomMode.findMany({
          where: { ...t, ...made },
          select: { therapistId: true, createdAt: true },
        }),
        this.prisma.therapyRelation.findMany({
          where: { ...t, ...made },
          select: { therapistId: true, createdAt: true },
        }),
      ]);
    return {
      notes: notes.map((r) => ({
        therapistId: r.therapistId,
        at: r.createdAt,
      })),
      tasks: tasks.flatMap((r) =>
        r.assignedBy === null
          ? []
          : [{ therapistId: r.assignedBy, at: r.createdAt }],
      ),
      planItems: planItems.map((r) => ({
        therapistId: r.therapistId,
        at: r.createdAt,
      })),
      guideMarks: marks.map((r) => ({
        therapistId: r.therapistId,
        at: r.createdAt,
      })),
      conceptualizations: concepts.map((r) => ({
        therapistId: r.therapistId,
        at: r.updatedAt,
      })),
      customModes: modes.map((r) => ({
        therapistId: r.therapistId,
        at: r.createdAt,
      })),
      invites: invites.map((r) => ({
        therapistId: r.therapistId,
        at: r.createdAt,
      })),
    };
  }
}

/** ФИО из заявки терапевта (хранится зашифрованным). */
function requestNames(
  rows: Array<{ userId: bigint; fullName: string }>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const name = decrypt(r.fullName)?.trim();
    if (name) out.set(String(r.userId), name);
  }
  return out;
}
