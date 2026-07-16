import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { MINIAPP_TGLINK } from '../telegram/telegram.constants';
import { decryptJson } from '../utils/crypto';
import { randomBytes } from 'crypto';
import { TherapyRelationInfo, TherapyClientSummary } from './therapy.types';

function randomCode(): string {
  return randomBytes(6).toString('hex').toUpperCase();
}

// Связи терапевт↔клиент: приглашения, подключение, список клиентов,
// alias/удаление клиента и граница доступа assertRelation (аудит 2026-07,
// 2а — единственный барьер между терапевтом и клиническими данными ЧУЖИХ
// клиентов). Другие therapy-сервисы инжектят этот сервис и зовут
// assertHasClient — текст проверки не дублируется.
@Injectable()
export class TherapyRelationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: BotAnalyticsService,
  ) {}

  // ─── Connection ─────────────────────────────────────────────────────────────

  async createInvite(
    therapistId: bigint,
  ): Promise<{ code: string; url: string }> {
    let code: string;
    do {
      code = randomCode();
    } while (await this.prisma.therapyRelation.findUnique({ where: { code } }));
    await this.prisma.therapyRelation.create({ data: { therapistId, code } });
    return { code, url: `${MINIAPP_TGLINK}?startapp=therapy_${code}` };
  }

  async joinAsClient(clientId: bigint, code: string): Promise<boolean> {
    const rel = await this.prisma.therapyRelation.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!rel || rel.status !== 'pending' || rel.clientId !== null) return false;
    if (rel.therapistId === clientId) return false;
    // Prevent duplicate: if already connected to this therapist, ignore silently
    const alreadyConnected = await this.prisma.therapyRelation.findFirst({
      where: { therapistId: rel.therapistId, clientId, status: 'active' },
    });
    if (alreadyConnected) return true;
    await this.prisma.therapyRelation.update({
      where: { id: rel.id },
      data: { clientId, status: 'active' },
    });
    return true;
  }

  async getRelation(userId: bigint): Promise<TherapyRelationInfo | null> {
    const uid = userId;
    const asTherapist = await this.prisma.therapyRelation.findFirst({
      where: { therapistId: uid, status: 'active' },
      include: { client: { select: { firstName: true } } },
    });
    if (asTherapist) {
      return {
        role: 'therapist',
        status: 'active',
        partnerName: asTherapist.client?.firstName ?? null,
        partnerId: asTherapist.clientId ? Number(asTherapist.clientId) : null,
        code: asTherapist.code,
        nextSession: null,
      };
    }
    const asClient = await this.prisma.therapyRelation.findFirst({
      where: { clientId: uid, status: 'active' },
      include: { therapist: { select: { id: true, firstName: true } } },
    });
    if (asClient) {
      return {
        role: 'client',
        status: 'active',
        partnerName: asClient.therapist?.firstName ?? null,
        partnerId: asClient.therapist ? Number(asClient.therapist.id) : null,
        code: asClient.code,
        nextSession: asClient.nextSession ?? null,
      };
    }
    return null;
  }

  async disconnect(userId: bigint): Promise<void> {
    await this.prisma.therapyRelation.deleteMany({
      where: { OR: [{ therapistId: userId }, { clientId: userId }] },
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
    const overviews = await this.analyticsService.getClientOverviews(
      relations
        .filter((rel) => rel.client !== null)
        .map((rel) => rel.client!.id),
    );
    const realClients = relations
      .filter((rel) => rel.client !== null)
      .map((rel) => {
        const clientBigId = rel.client!.id;
        const clientId = Number(clientBigId);
        const { streak, daysSince, history } = overviews.get(
          String(clientBigId),
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
          clientAlias: rel.clientAlias ?? null,
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
        telegramId: -rel.id,
        name: rel.virtualClientName as string,
        clientAlias: rel.clientAlias ?? null,
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
        virtualClientName: name.trim(),
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
  async assertHasClient(therapistId: bigint, clientId: number): Promise<void> {
    return this.assertRelation(therapistId, clientId);
  }

  private async assertRelation(
    therapistId: bigint,
    clientId: number,
  ): Promise<void> {
    if (clientId < 0) {
      // Virtual client — identified by -rel.id
      const rel = await this.prisma.therapyRelation.findFirst({
        where: { id: -clientId, therapistId, status: 'active' },
      });
      if (!rel) throw new Error('No active relation');
      return;
    }
    const rel = await this.prisma.therapyRelation.findFirst({
      where: { therapistId, clientId: BigInt(clientId), status: 'active' },
    });
    if (!rel) throw new Error('No active relation');
  }

  async renameClient(
    therapistId: bigint,
    clientId: number,
    alias: string,
  ): Promise<void> {
    if (clientId < 0) {
      await this.prisma.therapyRelation.updateMany({
        where: { id: -clientId, therapistId, status: 'active' },
        data: { clientAlias: alias.trim() || null },
      });
    } else {
      await this.prisma.therapyRelation.updateMany({
        where: { therapistId, clientId: BigInt(clientId), status: 'active' },
        data: { clientAlias: alias.trim() || null },
      });
    }
  }
}
