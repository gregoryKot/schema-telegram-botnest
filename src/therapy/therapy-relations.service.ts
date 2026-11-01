import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotClientOverviewService } from '../bot/bot.client-overview.service';
import { createTherapyInvite, joinTherapyAsClient } from './therapy-invite';
import {
  listTherapyInvites,
  previewTherapyInvite,
  revokeTherapyInvite,
  TherapyInviteView,
} from './therapy-invite-list';
import { getRelationInfo, meetingDaysOf } from './therapy-relation-info';
import { decryptJson } from '../utils/crypto';
import { decryptName, encryptName } from './client-name';
import { randomBytes } from 'crypto';
import { activeRelationWhere } from './relation-where';
import { TherapyRelationInfo, TherapyClientSummary } from './therapy.types';

// Связи терапевт↔клиент: приглашения, подключение, список клиентов,
// alias/удаление клиента и граница доступа assertRelation (аудит 2026-07,
// 2а — единственный барьер между терапевтом и клиническими данными ЧУЖИХ
// клиентов). Другие therapy-сервисы инжектят этот сервис и зовут
// assertHasClient — текст проверки не дублируется.
@Injectable()
export class TherapyRelationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientOverviewService: BotClientOverviewService,
  ) {}

  // ─── Connection ─────────────────────────────────────────────────────────────

  // Каждый вызов — новый код; alias — имя из «Новый клиент» (therapy-invite.ts).
  createInvite(
    therapistId: bigint,
    alias?: string,
  ): Promise<{ code: string; url: string }> {
    return createTherapyInvite(this.prisma, therapistId, alias);
  }

  listInvites(therapistId: bigint): Promise<TherapyInviteView[]> {
    return listTherapyInvites(this.prisma, therapistId);
  }

  revokeInvite(therapistId: bigint, id: number): Promise<boolean> {
    return revokeTherapyInvite(this.prisma, therapistId, id);
  }

  previewInvite(clientId: bigint, code: string) {
    return previewTherapyInvite(this.prisma, clientId, code);
  }

  // true — подключён, false — код не подошёл; бросает ALREADY_CONNECTED_ERROR
  // (подробности — в therapy-invite.ts).
  joinAsClient(clientId: bigint, code: string): Promise<boolean> {
    return joinTherapyAsClient(this.prisma, clientId, code);
  }

  getRelation(userId: bigint): Promise<TherapyRelationInfo | null> {
    return getRelationInfo(this.prisma, userId);
  }

  // Разрывает живые связи, где userId — КЛИЕНТ; `ended` (терапевт отказался от
  // роли) остаётся историей (client-map-authors.ts). Связи в роли терапевта не
  // трогаются: раньше DELETE /api/therapy/relation от терапевта сносил всех его
  // клиентов и приглашения, а заметки и карты оставались сиротами (аудит
  // 2026-10, T2). Терапевт убирает клиентов по одному (removeClient).
  async disconnect(userId: bigint): Promise<void> {
    await this.prisma.therapyRelation.deleteMany({
      where: { clientId: userId, status: { in: ['active', 'pending'] } },
    });
  }

  async getClients(therapistId: bigint): Promise<TherapyClientSummary[]> {
    const tid = therapistId;
    const relations = await this.prisma.therapyRelation.findMany({
      where: { therapistId: tid, status: 'active' },
      include: { client: { select: { id: true, firstName: true } } },
    });

    // Batch-load all conceptualizations for this therapist
    const concepts = await this.prisma.clientConceptualization.findMany({
      where: { therapistId: tid },
      select: { clientId: true, schemaIds: true },
    });
    const conceptMap = new Map<string, string[]>();
    for (const c of concepts) {
      const raw = c.schemaIds;
      const ids: string[] =
        typeof raw === 'string'
          ? (decryptJson<string[]>(raw) ?? [])
          : Array.isArray(raw)
            ? (raw as string[])
            : [];
      conceptMap.set(String(c.clientId), ids);
    }

    // Батч вместо ~6 SQL на клиента (аудит 2026-07, N+1): стрик, давность и
    // история всех клиентов достаются тремя запросами в getClientOverviews.
    const overviews = await this.clientOverviewService.getClientOverviews(
      relations
        .filter((rel) => rel.client !== null)
        .map((rel) => rel.client!.id),
    );
    const realClients = relations
      .filter((rel) => rel.client !== null)
      .map((rel) => {
        const clientId = rel.client!.id;
        const { streak, daysSince, history } = overviews.get(
          String(clientId),
        ) ?? {
          streak: 0,
          daysSince: -1,
          history: [],
        };
        const lastActiveDate =
          daysSince >= 0
            ? new Date(Date.now() - daysSince * 86400000)
                .toISOString()
                .slice(0, 10)
            : null;
        const byDate = new Map(history.map((d) => [d.date, d.ratings]));
        const recentIndexHistory: (number | null)[] = Array.from(
          { length: 14 },
          (_, i) => {
            const d = new Date(Date.now() - i * 86400000)
              .toISOString()
              .slice(0, 10);
            const r = byDate.get(d);
            if (!r) return null;
            const vals = Object.values(r);
            return vals.length === 5
              ? Math.round((vals.reduce((s, v) => s + v, 0) / 5) * 10) / 10
              : null;
          },
        );
        const todayIndex = recentIndexHistory[0];
        return {
          telegramId: clientId,
          name: rel.client!.firstName,
          clientAlias: decryptName(rel.clientAlias),
          streak,
          lastActiveDate,
          todayIndex,
          recentIndexHistory,
          relationCreatedAt: rel.createdAt.toISOString(),
          therapyStartDate: rel.therapyStartDate ?? null,
          nextSession: rel.nextSession ?? null,
          meetingDays: meetingDaysOf(rel.meetingDays),
          schemaIds: conceptMap.get(String(clientId)) ?? [],
        };
      });

    // Virtual (offline) clients: no Telegram account, identified by -rel.id
    const virtualClients: TherapyClientSummary[] = relations
      .filter((rel) => rel.client === null && rel.virtualClientName)
      .map((rel) => ({
        telegramId: -BigInt(rel.id),
        name: decryptName(rel.virtualClientName) as string,
        clientAlias: decryptName(rel.clientAlias),
        streak: 0,
        lastActiveDate: null,
        todayIndex: null,
        recentIndexHistory: Array(14).fill(null) as null[],
        relationCreatedAt: rel.createdAt.toISOString(),
        therapyStartDate: rel.therapyStartDate ?? null,
        nextSession: rel.nextSession ?? null,
        meetingDays: meetingDaysOf(rel.meetingDays),
        schemaIds: conceptMap.get(String(-rel.id)) ?? [],
      }));

    return [...realClients, ...virtualClients];
  }

  async addVirtualClient(
    therapistId: bigint,
    name: string,
  ): Promise<TherapyClientSummary[]> {
    const code = randomBytes(5).toString('hex').toUpperCase();
    await this.prisma.therapyRelation.create({
      data: {
        code,
        therapistId,
        clientId: null,
        status: 'active',
        virtualClientName: encryptName(name),
      },
    });
    return this.getClients(therapistId);
  }

  // ─── Access boundary ────────────────────────────────────────────────────────

  // Public wrapper for other therapy services/controller — same semantics as
  // the private helper used by all therapist-only data accessors.
  async assertHasClient(therapistId: bigint, clientId: bigint): Promise<void> {
    return this.assertRelation(therapistId, clientId);
  }

  private async assertRelation(
    therapistId: bigint,
    clientId: bigint,
  ): Promise<void> {
    const rel = await this.prisma.therapyRelation.findFirst({
      where: activeRelationWhere(therapistId, clientId),
    });
    if (!rel) throw new Error('No active relation');
  }

  async renameClient(
    therapistId: bigint,
    clientId: bigint,
    alias: string,
  ): Promise<void> {
    const { count } = await this.prisma.therapyRelation.updateMany({
      where: activeRelationWhere(therapistId, clientId),
      data: { clientAlias: encryptName(alias) },
    });
    // 0 строк — связи нет (клиент удалён, чужой, выдуман): раньше это был
    // тихий успех и «переименование» удалённого клиента (QA 2026-10-26).
    if (count === 0) throw new Error('No active relation');
  }
}
