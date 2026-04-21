import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { NotificationService } from '../notification/notification.service';
import { MINIAPP_TGLINK } from '../telegram/telegram.constants';
import { encrypt, decrypt, encryptJson, decryptJson } from '../utils/crypto';
import { randomBytes } from 'crypto';

function randomCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

const CONCEPT_TEXT_FIELDS = ['earlyExperience', 'unmetNeeds', 'triggers', 'copingStyles', 'goals', 'currentProblems', 'modeTransitions'] as const;

function encryptConceptFields(body: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of CONCEPT_TEXT_FIELDS) {
    if (f in body) result[f] = body[f] != null ? encrypt(body[f]) : null;
  }
  return result;
}

function decryptConceptFields(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of CONCEPT_TEXT_FIELDS) {
    result[f] = row[f] != null ? decrypt(row[f]) : null;
  }
  return result;
}

function decryptConceptSnapshot(snap: Record<string, any>): Record<string, any> {
  return { ...snap, ...decryptConceptFields(snap) };
}

import { localDate, localMidnightUTC } from '../utils/tz';
import { computeActiveSchemas, computeYsqScores } from '../utils/ysq';

export interface TherapyRelationInfo {
  role: 'therapist' | 'client';
  status: string;
  partnerName: string | null;
  partnerId: number | null;
  code: string;
  nextSession: string | null;
}

export interface TherapyClientSummary {
  telegramId: number;
  name: string | null;
  clientAlias: string | null;
  streak: number;
  lastActiveDate: string | null;
  todayIndex: number | null;
  relationCreatedAt: string;
  therapyStartDate: string | null;
  nextSession: string | null;
  meetingDays: number[];
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
    return { code, url: `${MINIAPP_TGLINK}?startapp=therapy_${code}` };
  }

  async joinAsClient(clientId: number, code: string): Promise<boolean> {
    const rel = await this.prisma.therapyRelation.findUnique({ where: { code: code.toUpperCase() } });
    if (!rel || rel.status !== 'pending' || rel.clientId !== null) return false;
    if (rel.therapistId === BigInt(clientId)) return false;
    // Prevent duplicate: if already connected to this therapist, ignore silently
    const alreadyConnected = await this.prisma.therapyRelation.findFirst({
      where: { therapistId: rel.therapistId, clientId: BigInt(clientId), status: 'active' },
    });
    if (alreadyConnected) return true;
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
      return { role: 'therapist', status: 'active', partnerName: asTherapist.client?.firstName ?? null, partnerId: asTherapist.clientId ? Number(asTherapist.clientId) : null, code: asTherapist.code, nextSession: null };
    }
    const asClient = await this.prisma.therapyRelation.findFirst({
      where: { clientId: uid, status: 'active' },
      include: { therapist: { select: { id: true, firstName: true } } },
    });
    if (asClient) {
      return { role: 'client', status: 'active', partnerName: asClient.therapist?.firstName ?? null, partnerId: asClient.therapist ? Number(asClient.therapist.id) : null, code: asClient.code, nextSession: (asClient as any).nextSession ?? null };
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

    const realClients = await Promise.all(
      relations
        .filter(rel => rel.client !== null)
        .map(async rel => {
          const clientId = Number(rel.client!.id);
          const [streak, daysSince, history] = await Promise.all([
            this.analyticsService.getConsecutiveDays(clientId),
            this.analyticsService.getDaysSinceLastFill(clientId),
            this.analyticsService.getHistoryRatings(clientId, 1),
          ]);
          const lastActiveDate = daysSince >= 0
            ? new Date(Date.now() - daysSince * 86400000).toISOString().slice(0, 10)
            : null;
          const todayRatings = history[0]?.ratings;
          const todayValues = todayRatings ? Object.values(todayRatings) : [];
          const todayIndex = todayValues.length === 5
            ? Math.round(todayValues.reduce((s, v) => s + v, 0) / 5 * 10) / 10
            : null;
          return { telegramId: clientId, name: rel.client!.firstName, clientAlias: (rel as any).clientAlias ?? null, streak, lastActiveDate, todayIndex, relationCreatedAt: rel.createdAt.toISOString(), therapyStartDate: (rel as any).therapyStartDate ?? null, nextSession: (rel as any).nextSession ?? null, meetingDays: ((rel as any).meetingDays as number[]) ?? [] };
        }),
    );

    // Virtual (offline) clients: no Telegram account, identified by -rel.id
    const virtualClients: TherapyClientSummary[] = relations
      .filter(rel => rel.client === null && (rel as any).virtualClientName)
      .map(rel => ({
        telegramId: -rel.id,
        name: (rel as any).virtualClientName as string,
        clientAlias: (rel as any).clientAlias ?? null,
        streak: 0,
        lastActiveDate: null,
        todayIndex: null,
        relationCreatedAt: rel.createdAt.toISOString(),
        therapyStartDate: (rel as any).therapyStartDate ?? null,
        nextSession: (rel as any).nextSession ?? null,
        meetingDays: ((rel as any).meetingDays as number[]) ?? [],
      }));

    return [...realClients, ...virtualClients];
  }

  async addVirtualClient(therapistId: number, name: string): Promise<TherapyClientSummary[]> {
    const code = randomBytes(5).toString('hex').toUpperCase();
    await (this.prisma.therapyRelation.create as any)({
      data: {
        code,
        therapistId: BigInt(therapistId),
        clientId: null,
        status: 'active',
        virtualClientName: name.trim(),
      },
    });
    return this.getClients(therapistId);
  }

  async addClientManually(therapistId: number, clientTelegramId: number) {
    const tid = BigInt(therapistId);
    const cid = BigInt(clientTelegramId);

    // Check client user exists
    const clientUser = await this.prisma.user.findUnique({ where: { id: cid }, select: { id: true, firstName: true } });
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

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  async createTask(userId: number, body: {
    type: string; text: string; targetDays?: number;
    needId?: string; dueDate?: string;
  }, assignedBy?: number) {
    const task = await this.prisma.userTask.create({
      data: {
        userId: BigInt(userId),
        assignedBy: assignedBy ? BigInt(assignedBy) : null,
        type: body.type,
        text: encrypt(body.text) ?? body.text,
        targetDays: body.targetDays ?? null,
        needId: body.needId ?? null,
        dueDate: body.dueDate ?? null,
      },
    });
    return { ...task, text: body.text }; // return plaintext to caller
  }

  async getTasks(userId: number) {
    const now = new Date();
    const uid = BigInt(userId);

    // Use user's stored timezone for correct "today" across all timezones
    const settings = await this.prisma.user.findUnique({ where: { id: uid }, select: { notifyTimezone: true } });
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
        this.prisma.schemaDiaryEntry.count({ where: { userId: uid, createdAt: { gte: startOfDay } } }),
        this.prisma.modeDiaryEntry.count({ where: { userId: uid, createdAt: { gte: startOfDay } } }),
        this.prisma.gratitudeDiaryEntry.count({ where: { userId: uid, date: today } }),
      ]).then(([s, m, g]) => s + m + g),
    ]);

    // Auto-expire overdue streak tasks
    const expired = tasks.filter(t => t.targetDays && Math.floor((now.getTime() - t.createdAt.getTime()) / 86_400_000) >= t.targetDays);
    if (expired.length > 0) {
      await Promise.all(expired.map(t => this.prisma.userTask.update({ where: { id: t.id }, data: { done: false, completedAt: now } })));
    }
    const expiredIds = new Set(expired.map(t => t.id));

    const STREAK_TYPES = new Set(['tracker_streak', 'diary_streak', 'schema_diary', 'mode_diary']);
    const activeTasks = tasks.filter(t => !expiredIds.has(t.id));

    return Promise.all(activeTasks.map(async task => {
      const doneToday = task.type === 'tracker_streak' ? trackerToday > 0
        : task.type === 'diary_streak' ? diaryToday > 0
        : undefined;
      const progress = task.targetDays && STREAK_TYPES.has(task.type)
        ? await this.getStreakProgress(userId, task.type, task.targetDays)
        : undefined;
      return { ...task, text: decrypt(task.text) ?? task.text, userId: Number(uid), assignedBy: task.assignedBy ? Number(task.assignedBy) : null, doneToday, progress };
    }));
  }

  async getTaskHistory(userId: number) {
    const rows = await this.prisma.userTask.findMany({
      where: { userId: BigInt(userId), done: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 30,
    });
    return rows.map(r => ({ ...r, text: decrypt(r.text) ?? r.text }));
  }

  async getTasksForClient(therapistId: number, clientId: number) {
    if (clientId < 0) {
      // Virtual client: look up by relation ID
      const rel = await this.prisma.therapyRelation.findFirst({
        where: { id: -clientId, therapistId: BigInt(therapistId), status: 'active' },
      });
      if (!rel) return null;
      const tasks = await this.prisma.userTask.findMany({
        where: { userId: BigInt(clientId), assignedBy: BigInt(therapistId) },
        orderBy: { createdAt: 'desc' },
      });
      return tasks.map(task => ({ ...task, text: decrypt(task.text) ?? task.text, userId: clientId, assignedBy: therapistId, doneToday: undefined, progress: undefined }));
    }
    const rel = await this.prisma.therapyRelation.findFirst({
      where: { therapistId: BigInt(therapistId), clientId: BigInt(clientId), status: 'active' },
    });
    if (!rel) return null;
    const now = new Date();
    const uid = BigInt(clientId);
    const settings = await this.prisma.user.findUnique({ where: { id: uid }, select: { notifyTimezone: true } });
    const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
    const today = localDate(tz, now);
    const startOfDay = localMidnightUTC(today, tz);

    const tasks = await this.prisma.userTask.findMany({
      where: { userId: uid, assignedBy: BigInt(therapistId) },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(tasks.map(async task => {
      let doneToday: boolean | undefined;
      let progress: number | undefined;
      if (task.type === 'tracker_streak') {
        doneToday = await this.prisma.rating.count({ where: { userId: uid, date: today } }).then(c => c > 0);
      } else if (task.type === 'diary_streak') {
        const [s, m, g] = await Promise.all([
          this.prisma.schemaDiaryEntry.count({ where: { userId: uid, createdAt: { gte: startOfDay } } }),
          this.prisma.modeDiaryEntry.count({ where: { userId: uid, createdAt: { gte: startOfDay } } }),
          this.prisma.gratitudeDiaryEntry.count({ where: { userId: uid, date: today } }),
        ]);
        doneToday = s + m + g > 0;
      }
      if (task.targetDays && ['tracker_streak', 'diary_streak', 'schema_diary', 'mode_diary'].includes(task.type)) {
        progress = await this.getStreakProgress(clientId, task.type, task.targetDays);
      }
      return { ...task, text: decrypt(task.text) ?? task.text, userId: Number(uid), assignedBy: task.assignedBy ? Number(task.assignedBy) : null, doneToday, progress };
    }));
  }

  async completeTask(userId: number, taskId: number, done: boolean): Promise<boolean> {
    const result = await this.prisma.userTask.updateMany({
      where: { id: taskId, userId: BigInt(userId) },
      data: { done, completedAt: new Date() },
    });
    return result.count > 0;
  }

  async checkStreakTasks(userId: number): Promise<void> {
    const tasks = await this.prisma.userTask.findMany({
      where: { userId: BigInt(userId), done: null, type: { in: ['diary_streak', 'tracker_streak', 'schema_diary', 'mode_diary'] } },
    });
    if (tasks.length === 0) return;
    const now = new Date();
    const progresses = await Promise.all(tasks.map(t => this.getStreakProgress(userId, t.type, t.targetDays ?? 7)));
    const completed = tasks.filter((t, i) => progresses[i] >= (t.targetDays ?? 7));
    if (completed.length > 0) {
      await Promise.all(completed.map(t => this.prisma.userTask.update({ where: { id: t.id }, data: { done: true, completedAt: now } })));
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

  // ─── Session Info ────────────────────────────────────────────────────────────

  async updateSessionInfo(therapistId: number, clientId: number, body: {
    therapyStartDate?: string | null;
    nextSession?: string | null;
    meetingDays?: number[];
  }): Promise<void> {
    await this.assertRelation(therapistId, clientId);
    const data: Record<string, unknown> = {};
    if (body.therapyStartDate !== undefined) data['therapyStartDate'] = body.therapyStartDate;
    if (body.nextSession !== undefined) data['nextSession'] = body.nextSession;
    if (body.meetingDays !== undefined) data['meetingDays'] = body.meetingDays;
    if (Object.keys(data).length === 0) return;
    if (clientId < 0) {
      await this.prisma.therapyRelation.updateMany({
        where: { id: -clientId, therapistId: BigInt(therapistId), status: 'active' },
        data: data as any,
      });
    } else {
      await this.prisma.therapyRelation.updateMany({
        where: { therapistId: BigInt(therapistId), clientId: BigInt(clientId), status: 'active' },
        data: data as any,
      });
    }
  }

  // ─── Session Notes ───────────────────────────────────────────────────────────

  private async assertRelation(therapistId: number, clientId: number): Promise<void> {
    if (clientId < 0) {
      // Virtual client — identified by -rel.id
      const rel = await this.prisma.therapyRelation.findFirst({
        where: { id: -clientId, therapistId: BigInt(therapistId), status: 'active' },
      });
      if (!rel) throw new Error('No active relation');
      return;
    }
    const rel = await this.prisma.therapyRelation.findFirst({
      where: { therapistId: BigInt(therapistId), clientId: BigInt(clientId), status: 'active' },
    });
    if (!rel) throw new Error('No active relation');
  }

  async getNotes(therapistId: number, clientId: number) {
    await this.assertRelation(therapistId, clientId);
    const rows = await this.prisma.therapistNote.findMany({
      where: { therapistId: BigInt(therapistId), clientId: BigInt(clientId) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(r => ({ ...r, text: decrypt(r.text) ?? r.text }));
  }

  async createNote(therapistId: number, clientId: number, body: { date: string; text: string }) {
    await this.assertRelation(therapistId, clientId);
    const note = await this.prisma.therapistNote.create({
      data: { therapistId: BigInt(therapistId), clientId: BigInt(clientId), date: body.date, text: encrypt(body.text) ?? body.text },
    });
    return { ...note, text: body.text }; // return plaintext to caller
  }

  async deleteNote(therapistId: number, noteId: number): Promise<void> {
    await this.prisma.therapistNote.deleteMany({
      where: { id: noteId, therapistId: BigInt(therapistId) },
    });
  }

  // ─── Case Conceptualization ──────────────────────────────────────────────────

  async getConceptualization(therapistId: number, clientId: number) {
    await this.assertRelation(therapistId, clientId);
    const row = await this.prisma.clientConceptualization.findUnique({
      where: { therapistId_clientId: { therapistId: BigInt(therapistId), clientId: BigInt(clientId) } },
    });
    if (!row) return null;
    const history = Array.isArray(row.history) ? (row.history as any[]).map(decryptConceptSnapshot) : [];
    return { ...row, ...decryptConceptFields(row), history };
  }

  async saveConceptualization(therapistId: number, clientId: number, body: {
    schemaIds?: string[]; modeIds?: string[];
    earlyExperience?: string; unmetNeeds?: string;
    triggers?: string; copingStyles?: string; goals?: string; currentProblems?: string;
    modeTransitions?: string;
  }) {
    await this.assertRelation(therapistId, clientId);
    const tid = BigInt(therapistId);
    const cid = BigInt(clientId);

    // Fetch current state to push to history before overwriting
    const existing = await this.prisma.clientConceptualization.findUnique({
      where: { therapistId_clientId: { therapistId: tid, clientId: cid } },
    });

    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let history: any[] = Array.isArray(existing?.history) ? (existing.history as any[]) : [];

    if (existing) {
      // Snapshot current state into history (max 20 snapshots)
      const snapshot = {
        savedAt: now,
        schemaIds: existing.schemaIds,
        modeIds: existing.modeIds,
        earlyExperience: existing.earlyExperience,
        unmetNeeds: existing.unmetNeeds,
        triggers: existing.triggers,
        copingStyles: existing.copingStyles,
        goals: existing.goals,
        currentProblems: existing.currentProblems,
        modeTransitions: (existing as any).modeTransitions ?? null,
      };
      history = [snapshot, ...history].slice(0, 20);
    }

    const enc = encryptConceptFields(body);
    const saved = await (this.prisma.clientConceptualization.upsert as any)({
      where: { therapistId_clientId: { therapistId: tid, clientId: cid } },
      create: {
        therapistId: tid, clientId: cid,
        schemaIds: body.schemaIds ?? [], modeIds: body.modeIds ?? [],
        earlyExperience: enc.earlyExperience ?? null,
        unmetNeeds: enc.unmetNeeds ?? null,
        triggers: enc.triggers ?? null,
        copingStyles: enc.copingStyles ?? null,
        goals: enc.goals ?? null,
        currentProblems: enc.currentProblems ?? null,
        modeTransitions: enc.modeTransitions ?? null,
        history: [],
      },
      update: {
        ...(body.schemaIds !== undefined && { schemaIds: body.schemaIds }),
        ...(body.modeIds !== undefined && { modeIds: body.modeIds }),
        ...Object.fromEntries(Object.entries(enc).filter(([k]) => body[k] !== undefined)),
        history,
      },
    });
    return { ...saved, ...decryptConceptFields(saved), history: history.map(decryptConceptSnapshot) };
  }

  // ─── Client data for therapist ───────────────────────────────────────────────

  async getClientData(therapistId: number, clientId: number) {
    await this.assertRelation(therapistId, clientId);
    if (clientId < 0) {
      return { name: null, mySchemaIds: [], myModeIds: [], ysqCompletedAt: null, ysqActiveSchemaIds: [] };
    }
    const uid = BigInt(clientId);
    const [user, ysq, rawHistory] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: uid }, select: { firstName: true, mySchemaIds: true, myModeIds: true, therapistShareProfile: true } }),
      this.prisma.ysqResult.findUnique({ where: { userId: uid } }),
      this.prisma.ysqResultHistory.findMany({ where: { userId: uid }, orderBy: { completedAt: 'desc' }, take: 20 }),
    ]);

    if (user?.therapistShareProfile === false) {
      return { name: user?.firstName ?? null, mySchemaIds: [], myModeIds: [], ysqCompletedAt: null, ysqActiveSchemaIds: [], ysqHistory: [] };
    }

    const ysqActiveSchemaIds = ysq?.answers ? computeActiveSchemas(ysq.answers as number[]) : [];
    const ysqHistory = rawHistory.map(r => ({
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

  async scheduleTaskNotification(clientId: number, task: { text: string; needId: string | null; dueDate: string | null }): Promise<void> {
    await this.notificationService.schedule(clientId, 'task_assigned', new Date(), {
      text: task.text, needId: task.needId, dueDate: task.dueDate,
    });
  }

  async renameClient(therapistId: number, clientId: number, alias: string): Promise<void> {
    if (clientId < 0) {
      await this.prisma.therapyRelation.updateMany({
        where: { id: -clientId, therapistId: BigInt(therapistId), status: 'active' },
        data: { clientAlias: alias.trim() || null } as any,
      });
    } else {
      await this.prisma.therapyRelation.updateMany({
        where: { therapistId: BigInt(therapistId), clientId: BigInt(clientId), status: 'active' },
        data: { clientAlias: alias.trim() || null } as any,
      });
    }
  }

  async removeClient(therapistId: number, clientId: number): Promise<void> {
    const tid = BigInt(therapistId);
    const cid = BigInt(clientId);
    await this.prisma.$transaction([
      this.prisma.therapistNote.deleteMany({ where: { therapistId: tid, clientId: cid } }),
      this.prisma.clientConceptualization.deleteMany({
        where: { therapistId: tid, clientId: cid },
      }),
      clientId < 0
        ? this.prisma.therapyRelation.deleteMany({ where: { id: -clientId, therapistId: tid } })
        : this.prisma.therapyRelation.deleteMany({ where: { therapistId: tid, clientId: cid } }),
    ]);
  }

  async requestYsq(therapistId: number, clientId: number): Promise<void> {
    await this.assertRelation(therapistId, clientId);
    if (clientId < 0) return; // Virtual client — no Telegram account, cannot send notification
    const therapist = await this.prisma.user.findUnique({
      where: { id: BigInt(therapistId) }, select: { firstName: true },
    });
    await this.notificationService.schedule(clientId, 'ysq_requested', new Date(), {
      therapistName: therapist?.firstName ?? null,
    });
  }
}
