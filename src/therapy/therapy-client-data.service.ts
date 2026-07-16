import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { NotificationService } from '../notification/notification.service';
import { TherapyRelationsService } from './therapy-relations.service';
import {
  decrypt,
  decryptJson,
  decryptRecord,
  EncryptSchema,
} from '../utils/crypto';
import { computeActiveSchemas, computeYsqScores } from '../utils/ysq';

const SCHEMA_NOTE_SCHEMA: EncryptSchema = {
  strings: [
    'triggers',
    'feelings',
    'thoughts',
    'origins',
    'reality',
    'healthyView',
    'behavior',
  ],
};
const MODE_NOTE_SCHEMA: EncryptSchema = {
  strings: ['triggers', 'feelings', 'thoughts', 'needs', 'behavior'],
};

// Данные клиента для терапевта: профиль/YSQ, история, дневники, заметки,
// запрос YSQ, инфо о сессии и удаление клиента. Кроме удаления — везде
// обязательна проверка assertHasClient (чужие клинические данные).
@Injectable()
export class TherapyClientDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly notificationService: NotificationService,
    private readonly relationsService: TherapyRelationsService,
  ) {}

  async getClientData(therapistId: bigint, clientId: number) {
    await this.relationsService.assertHasClient(therapistId, clientId);
    if (clientId < 0) {
      return {
        name: null,
        mySchemaIds: [],
        myModeIds: [],
        ysqCompletedAt: null,
        ysqActiveSchemaIds: [],
      };
    }
    const uid = BigInt(clientId);
    const [user, ysq, rawHistory] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: uid },
        select: {
          firstName: true,
          mySchemaIds: true,
          myModeIds: true,
          therapistShareProfile: true,
        },
      }),
      this.prisma.ysqResult.findUnique({ where: { userId: uid } }),
      this.prisma.ysqResultHistory.findMany({
        where: { userId: uid },
        orderBy: { completedAt: 'desc' },
        take: 20,
      }),
    ]);

    if (user?.therapistShareProfile === false) {
      return {
        name: user?.firstName ?? null,
        mySchemaIds: [],
        myModeIds: [],
        ysqCompletedAt: null,
        ysqActiveSchemaIds: [],
        ysqHistory: [],
      };
    }

    const ysqActiveSchemaIds = ysq?.answers
      ? computeActiveSchemas(ysq.answers as number[])
      : [];
    const ysqHistory = rawHistory.map((r) => ({
      id: r.id,
      completedAt: r.completedAt.toISOString(),
      scores: computeYsqScores(r.answers as number[]),
    }));

    return {
      name: user?.firstName ?? null,
      mySchemaIds: (user?.mySchemaIds as string[]) ?? [],
      myModeIds: (user?.myModeIds as string[]) ?? [],
      ysqCompletedAt: ysq?.completedAt?.toISOString() ?? null,
      ysqActiveSchemaIds,
      ysqHistory,
    };
  }

  async getClientHistory(
    therapistId: bigint,
    clientId: number,
  ): Promise<
    { date: string; index: number | null; ratings: Record<string, number> }[]
  > {
    if (clientId < 0) return [];
    await this.relationsService.assertHasClient(therapistId, clientId);
    const history = await this.analyticsService.getHistoryRatings(
      BigInt(clientId),
      14,
    );
    return history.map((h) => {
      const ratings = h.ratings as Record<string, number>;
      const vals = Object.values(ratings);
      const index =
        vals.length === 5
          ? Math.round((vals.reduce((s, v) => s + v, 0) / 5) * 10) / 10
          : null;
      return { date: h.date, index, ratings };
    });
  }

  async getClientDiaryEntries(
    therapistId: bigint,
    clientId: number,
  ): Promise<
    {
      type: 'schema' | 'mode' | 'gratitude';
      date: string;
      schemaIds?: string[];
      modeId?: string;
      excerpt: string;
    }[]
  > {
    if (clientId < 0) return [];
    await this.relationsService.assertHasClient(therapistId, clientId);
    const uid = BigInt(clientId);
    const [schemaRows, modeRows, gratitudeRows] = await Promise.all([
      this.prisma.schemaDiaryEntry.findMany({
        where: { userId: uid },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { schemaIds: true, trigger: true, createdAt: true },
      }),
      this.prisma.modeDiaryEntry.findMany({
        where: { userId: uid },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { modeId: true, situation: true, createdAt: true },
      }),
      this.prisma.gratitudeDiaryEntry.findMany({
        where: { userId: uid },
        orderBy: { date: 'desc' },
        take: 10,
        select: { date: true, items: true },
      }),
    ]);

    const entries: {
      type: 'schema' | 'mode' | 'gratitude';
      dateMs: number;
      date: string;
      schemaIds?: string[];
      modeId?: string;
      excerpt: string;
    }[] = [];

    for (const r of schemaRows) {
      const schemaIds: string[] =
        typeof r.schemaIds === 'string'
          ? (decryptJson<string[]>(r.schemaIds) ?? [])
          : ((r.schemaIds as string[]) ?? []);
      const trigger = decrypt(r.trigger) ?? r.trigger;
      entries.push({
        type: 'schema',
        dateMs: r.createdAt.getTime(),
        date: r.createdAt.toISOString().slice(0, 10),
        schemaIds,
        excerpt: trigger,
      });
    }

    for (const r of modeRows) {
      const modeId = decrypt(r.modeId) ?? r.modeId;
      const situation = decrypt(r.situation) ?? r.situation;
      entries.push({
        type: 'mode',
        dateMs: r.createdAt.getTime(),
        date: r.createdAt.toISOString().slice(0, 10),
        modeId,
        excerpt: situation,
      });
    }

    for (const r of gratitudeRows) {
      const items: string[] =
        typeof r.items === 'string'
          ? (decryptJson<string[]>(r.items) ?? [])
          : ((r.items as string[]) ?? []);
      entries.push({
        type: 'gratitude',
        dateMs: new Date(r.date + 'T00:00:00').getTime(),
        date: r.date,
        excerpt: items.slice(0, 2).join(' · '),
      });
    }

    return entries
      .sort((a, b) => b.dateMs - a.dateMs)
      .slice(0, 10)
      .map(({ dateMs: _d, ...rest }) => rest);
  }

  async getClientSchemaNotes(therapistId: bigint, clientId: number) {
    if (clientId < 0) return [];
    await this.relationsService.assertHasClient(therapistId, clientId);
    const rows = await this.prisma.userSchemaNote.findMany({
      where: { userId: BigInt(clientId) },
    });
    return rows.map((r) => decryptRecord(r, SCHEMA_NOTE_SCHEMA));
  }

  async getClientModeNotes(therapistId: bigint, clientId: number) {
    if (clientId < 0) return [];
    await this.relationsService.assertHasClient(therapistId, clientId);
    const rows = await this.prisma.userModeNote.findMany({
      where: { userId: BigInt(clientId) },
    });
    return rows.map((r) => decryptRecord(r, MODE_NOTE_SCHEMA));
  }

  async requestYsq(therapistId: bigint, clientId: number): Promise<void> {
    await this.relationsService.assertHasClient(therapistId, clientId);
    if (clientId < 0) return; // Virtual client — no Telegram account, cannot send notification
    const therapist = await this.prisma.user.findUnique({
      where: { id: therapistId },
      select: { firstName: true },
    });
    await this.notificationService.schedule(
      BigInt(clientId),
      'ysq_requested',
      new Date(),
      {
        therapistName: therapist?.firstName ?? null,
      },
    );
  }

  // ─── Session Info ────────────────────────────────────────────────────────────
  async updateSessionInfo(
    therapistId: bigint,
    clientId: number,
    body: {
      therapyStartDate?: string | null;
      nextSession?: string | null;
      meetingDays?: number[];
    },
  ): Promise<void> {
    await this.relationsService.assertHasClient(therapistId, clientId);
    const data: Record<string, unknown> = {};
    if (body.therapyStartDate !== undefined)
      data['therapyStartDate'] = body.therapyStartDate;
    if (body.nextSession !== undefined) data['nextSession'] = body.nextSession;
    if (body.meetingDays !== undefined) data['meetingDays'] = body.meetingDays;
    if (Object.keys(data).length === 0) return;
    const mutation = data as Prisma.TherapyRelationUpdateManyMutationInput;
    if (clientId < 0) {
      await this.prisma.therapyRelation.updateMany({
        where: { id: -clientId, therapistId, status: 'active' },
        data: mutation,
      });
    } else {
      await this.prisma.therapyRelation.updateMany({
        where: { therapistId, clientId: BigInt(clientId), status: 'active' },
        data: mutation,
      });
    }
  }

  // ─── Remove client from list ─────────────────────────────────────────────────
  async removeClient(therapistId: bigint, clientId: number): Promise<void> {
    const tid = therapistId;
    const cid = BigInt(clientId);
    await this.prisma.$transaction([
      this.prisma.therapistNote.deleteMany({
        where: { therapistId: tid, clientId: cid },
      }),
      this.prisma.clientConceptualization.deleteMany({
        where: { therapistId: tid, clientId: cid },
      }),
      clientId < 0
        ? this.prisma.therapyRelation.deleteMany({
            where: { id: -clientId, therapistId: tid },
          })
        : this.prisma.therapyRelation.deleteMany({
            where: { therapistId: tid, clientId: cid },
          }),
    ]);
  }
}
