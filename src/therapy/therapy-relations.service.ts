import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotClientOverviewService } from '../bot/bot.client-overview.service';
import { createTherapyInvite, joinTherapyAsClient } from './therapy-invite';
import { getRelationInfo } from './therapy-relation-info';
import { encrypt, decrypt, decryptJson } from '../utils/crypto';

// Имена клиентов, введённые терапевтом (алиас и офлайн-клиент) — PII,
// шифруются; легаси plaintext читается как есть (decrypt tolerant).
const decName = (v: string | null): string | null =>
  v == null ? null : (decrypt(v) ?? v);
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

  createInvite(therapistId: bigint): Promise<{ code: string; url: string }> {
    return createTherapyInvite(this.prisma, therapistId);
  }

  // true — подключён, false — код не подошёл; бросает ALREADY_CONNECTED_ERROR
  // (подробности — в therapy-invite.ts).
  joinAsClient(clientId: bigint, code: string): Promise<boolean> {
    return joinTherapyAsClient(this.prisma, clientId, code);
  }

  getRelation(userId: bigint): Promise<TherapyRelationInfo | null> {
    return getRelationInfo(this.prisma, userId);
  }

  // Разрывает связи, где userId — КЛИЕНТ. Раньше удалялись и связи, где он
  // терапевт: один вызов DELETE /api/therapy/relation от терапевта сносил всех
  // его клиентов, офлайн-клиентов и приглашения, а заметки и карты оставались
  // сиротами (аудит 2026-10, T2). Терапевт убирает клиентов по одному через
  // DELETE clients/:clientId (removeClient).
  async disconnect(userId: bigint): Promise<void> {
    await this.prisma.therapyRelation.deleteMany({
      where: { clientId: userId },
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
          clientAlias: decName(rel.clientAlias),
          streak,
          lastActiveDate,
          todayIndex,
          recentIndexHistory,
          relationCreatedAt: rel.createdAt.toISOString(),
          therapyStartDate: rel.therapyStartDate ?? null,
          nextSession: rel.nextSession ?? null,
          meetingDays: (rel.meetingDays as number[]) ?? [],
          schemaIds: conceptMap.get(String(clientId)) ?? [],
        };
      });

    // Virtual (offline) clients: no Telegram account, identified by -rel.id
    const virtualClients: TherapyClientSummary[] = relations
      .filter((rel) => rel.client === null && rel.virtualClientName)
      .map((rel) => ({
        telegramId: -BigInt(rel.id),
        name: decName(rel.virtualClientName) as string,
        clientAlias: decName(rel.clientAlias),
        streak: 0,
        lastActiveDate: null,
        todayIndex: null,
        recentIndexHistory: Array(14).fill(null) as null[],
        relationCreatedAt: rel.createdAt.toISOString(),
        therapyStartDate: rel.therapyStartDate ?? null,
        nextSession: rel.nextSession ?? null,
        meetingDays: (rel.meetingDays as number[]) ?? [],
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
        virtualClientName: encrypt(name.trim()) ?? name.trim(),
      },
    });
    return this.getClients(therapistId);
  }

  async addClientManually(therapistId: bigint, clientTelegramId: bigint) {
    const tid = therapistId;
    const cid = clientTelegramId;

    // Check client user exists
    const clientUser = await this.prisma.user.findUnique({
      where: { id: cid },
      select: { id: true, firstName: true },
    });
    if (!clientUser) throw new Error('User not found');

    // Check no existing active relation
    const existing = await this.prisma.therapyRelation.findFirst({
      where: { therapistId: tid, clientId: cid, status: 'active' },
    });
    if (existing) throw new Error('Already connected');

    // Create active relation directly (no invite code needed — use random code)
    const code = randomBytes(5).toString('hex').toUpperCase();
    await this.prisma.therapyRelation.create({
      data: { code, therapistId: tid, clientId: cid, status: 'active' },
    });

    // Return updated client list
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
    const encAlias = alias.trim() ? encrypt(alias.trim()) : null;
    await this.prisma.therapyRelation.updateMany({
      where: activeRelationWhere(therapistId, clientId),
      data: { clientAlias: encAlias },
    });
  }
}
