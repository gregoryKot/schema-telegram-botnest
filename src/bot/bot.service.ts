import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VALID_TIMEZONES } from '../telegram/telegram.constants';
import {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  encryptRecord,
  decryptRecord,
  EncryptSchema,
} from '../utils/crypto';
import { randomBytes, timingSafeEqual } from 'crypto';

// ── User data registry ───────────────────────────────────────────────────────
// CHECKLIST when adding a new table with userId:
//   1. Add the model name here — deleteAllUserData will clear it automatically
//   2. In service methods: use encryptRecord/decryptRecord (from utils/crypto)
//      and declare an EncryptSchema constant near the methods
//   3. Add onDelete: Cascade on the User relation in schema.prisma
//   4. Run `npx prisma generate` after schema changes
//
// TypeScript: if a name doesn't exist on PrismaService you get a compile error.
export const USER_DATA_TABLES = [
  'rating',
  'note',
  'userSchemaNote',
  'userModeNote',
  'userBeliefCheck',
  'userLetter',
  'userSafePlace',
  'userFlashcard',
  'userPractice',
  'practicePlan',
  'childhoodRating',
  'ysqResult',
  'ysqProgress',
  'ysqResultHistory',
  'scheduledNotification',
  'schemaDiaryEntry',
  'modeDiaryEntry',
  'gratitudeDiaryEntry',
  'appActivity',
  'userTask',
  'diaryDraft',
  'emailToken',
] as const;
// Compile-time check: any invalid table name above becomes a TS error here.
type _VerifyTables = {
  [K in (typeof USER_DATA_TABLES)[number]]: PrismaService[K];
};

export const NEED_IDS = [
  'attachment',
  'autonomy',
  'expression',
  'play',
  'limits',
] as const;
export type NeedId = (typeof NEED_IDS)[number];

export interface Need {
  id: NeedId;
  emoji: string; // для сводки и идентификации
  title: string; // короткое — для кнопок
  fullTitle: string; // полное — для экрана оценки и FAQ
  chartLabel: string; // для диаграммы (без эмодзи)
}

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly needs: Need[] = [
    {
      id: 'attachment',
      emoji: '🤝',
      title: '🤝 Привязанность',
      fullTitle:
        'Безопасная привязанность\n(безопасность, стабильность, забота, принятие)',
      chartLabel: 'Привязанность',
    },
    {
      id: 'autonomy',
      emoji: '🚀',
      title: '🚀 Автономия',
      fullTitle: 'Автономия, компетентность и чувство идентичности',
      chartLabel: 'Автономия',
    },
    {
      id: 'expression',
      emoji: '💬',
      title: '💬 Выражение чувств',
      fullTitle: 'Свобода выражать потребности и эмоции',
      chartLabel: 'Выражение чувств',
    },
    {
      id: 'play',
      emoji: '🎉',
      title: '🎉 Спонтанность',
      fullTitle: 'Спонтанность и игра',
      chartLabel: 'Спонтанность',
    },
    {
      id: 'limits',
      emoji: '⚖️',
      title: '⚖️ Границы',
      fullTitle: 'Реалистичные границы и самоконтроль',
      chartLabel: 'Границы',
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  getNeeds(): Need[] {
    return this.needs;
  }

  private localDateString(tz: string, base = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(base);
  }

  private async userTimezone(userId: bigint): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifyTimezone: true },
    });
    return user?.notifyTimezone ?? 'Europe/Moscow';
  }

  async registerUser(userId: bigint, firstName?: string, timezone?: string) {
    const validTz =
      typeof timezone === 'string' && VALID_TIMEZONES.includes(timezone);
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {
        ...(firstName ? { firstName } : {}),
        botBlockedAt: null,
        deletedAt: null,
      },
      create: {
        id: userId,
        firstName,
        ...(validTz ? { notifyTimezone: timezone } : {}),
      },
    });
  }

  async getUserFirstName(userId: bigint): Promise<string | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });
    return u?.firstName ?? null;
  }

  async acceptDisclaimer(userId: bigint): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { disclaimerAccepted: true },
    });
  }

  async hasAcceptedDisclaimer(userId: bigint): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { disclaimerAccepted: true },
    });
    return u?.disclaimerAccepted ?? false;
  }

  async getYsqProgress(
    userId: bigint,
  ): Promise<{ answers: number[]; page: number } | null> {
    const r = await this.prisma.ysqProgress.findUnique({ where: { userId } });
    if (!r) return null;
    return { answers: r.answers as number[], page: r.page };
  }

  async saveYsqProgress(
    userId: bigint,
    answers: number[],
    page: number,
  ): Promise<void> {
    await this.prisma.ysqProgress.upsert({
      where: { userId },
      update: { answers, page, updatedAt: new Date() },
      create: { userId, answers, page },
    });
  }

  async deleteYsqProgress(userId: bigint): Promise<void> {
    await this.prisma.ysqProgress.deleteMany({ where: { userId } });
  }

  async getUserSettings(userId: bigint) {
    // Explicit select — only return fields used by the API. Adding a new
    // public setting? Add it here AND in api.controller.getSettings().
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifyEnabled: true,
        notifyLocalHour: true,
        notifyTimezone: true,
        notifyReminderEnabled: true,
        notifyFrequency: true,
        notifyQuietStart: true,
        notifyQuietEnd: true,
        notifyGamified: true,
        notifyPausedUntil: true,
        notifyNextRemindDate: true,
        addressForm: true,
        pairCardDismissed: true,
        mySchemaIds: true,
        myModeIds: true,
        therapistShareCards: true,
        therapistShareProfile: true,
      },
    });
    if (!row) return row;
    // Decrypt clinical labels if encrypted (forward-compat with plaintext rows).
    return decryptRecord(row as any, {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
  }

  async updateUserSettings(
    userId: bigint,
    data: {
      notifyEnabled?: boolean;
      notifyLocalHour?: number;
      notifyTimezone?: string;
      notifyReminderEnabled?: boolean;
      notifyFrequency?: number;
      notifyQuietStart?: number;
      notifyQuietEnd?: number;
      notifyGamified?: boolean;
      notifyPausedUntil?: Date | null;
      addressForm?: string;
      pairCardDismissed?: boolean;
      mySchemaIds?: string[];
      myModeIds?: string[];
      therapistShareCards?: boolean;
      therapistShareProfile?: boolean;
    },
  ) {
    const enc = encryptRecord(data as Record<string, unknown>, {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
    await this.prisma.user.update({ where: { id: userId }, data: enc as any });
  }

  async getNote(
    userId: bigint,
    date: string,
  ): Promise<{ text: string | null; tags: string[] }> {
    const note = await this.prisma.note.findUnique({
      where: { userId_date: { userId, date } },
    });
    return {
      text: note?.text ? decrypt(note.text) : null,
      // Tags: new rows store comma-joined encrypted blob; legacy rows store
      // comma-joined plaintext. decrypt() returns plaintext unchanged.
      tags: note?.tags
        ? (decrypt(note.tags) ?? '').split(',').filter(Boolean)
        : [],
    };
  }

  async saveNote(userId: bigint, date: string, text: string, tags?: string[]) {
    const tagsPlain = tags ? tags.join(',') : '';
    const encText = encrypt(text) ?? text;
    const encTags = encrypt(tagsPlain) ?? tagsPlain;
    await this.prisma.note.upsert({
      where: { userId_date: { userId, date } },
      update: { text: encText, tags: encTags },
      create: { userId, date, text: encText, tags: encTags },
    });
  }

  async markUserBlocked(userId: bigint): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, botBlockedAt: null },
      data: { botBlockedAt: new Date() },
    });
  }

  async getAllUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return users.map((u) => Number(u.id));
  }

  async getBroadcastUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, botBlockedAt: null },
      select: { id: true },
    });
    return users.map((u) => Number(u.id));
  }

  async getAllUsersWithSettings() {
    return this.prisma.user.findMany({
      where: { notifyEnabled: true, botBlockedAt: null, deletedAt: null },
      select: {
        id: true,
        notifyLocalHour: true,
        notifyTimezone: true,
        notifyReminderEnabled: true,
        notifyGamified: true,
        notifyFrequency: true,
        notifyAdaptiveLevel: true,
        notifyIgnoredCount: true,
        notifyNextRemindDate: true,
        notifySkipAckDate: true,
        notifyLastEvalDate: true,
        notifyPausedUntil: true,
        addressForm: true,
      },
    });
  }

  /** Явный выбор частоты сбрасывает адаптацию на выбранный уровень */
  async setAdaptiveLevel(userId: bigint, level: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { notifyAdaptiveLevel: level, notifyIgnoredCount: 0 },
    });
  }

  /** Тихие часы + таймзона + форма обращения для пачки юзеров (processQueue) */
  async getSendSettingsFor(
    ids: bigint[],
  ): Promise<
    Map<string, { tz: string; start: number; end: number; form: string | null }>
  > {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        notifyTimezone: true,
        notifyQuietStart: true,
        notifyQuietEnd: true,
        addressForm: true,
      },
    });
    return new Map(
      rows.map((r) => [
        r.id.toString(),
        {
          tz: r.notifyTimezone,
          start: r.notifyQuietStart,
          end: r.notifyQuietEnd,
          form: r.addressForm,
        },
      ]),
    );
  }

  async saveRating(
    userId: bigint,
    needId: NeedId,
    value: number,
    date?: string,
  ) {
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new Error('Rating must be integer 0..10');
    }
    const dt = date ?? this.localDateString(await this.userTimezone(userId));
    await this.prisma.rating.upsert({
      where: { userId_date_needId: { userId, date: dt, needId } },
      update: { value },
      create: { userId, date: dt, needId, value },
    });
  }

  async getRatings(userId: bigint, date?: string) {
    const dt = date ?? this.localDateString(await this.userTimezone(userId));
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: dt },
    });
    return Object.fromEntries(rows.map((r) => [r.needId, r.value])) as Partial<
      Record<NeedId, number>
    >;
  }

  async getUserPair(userId: bigint): Promise<{
    code: string;
    status: string;
    isCreator: boolean;
    partnerId: number | null;
  } | null> {
    const uid = userId;
    const pair = await this.prisma.pair.findFirst({
      where: { OR: [{ userId1: uid }, { userId2: uid }] },
      orderBy: { createdAt: 'desc' },
    });
    if (!pair) return null;
    const isCreator = pair.userId1 === uid;
    const partnerId = isCreator
      ? pair.userId2
        ? Number(pair.userId2)
        : null
      : Number(pair.userId1);
    return { code: pair.code, status: pair.status, isCreator, partnerId };
  }

  async getUserPairs(userId: bigint): Promise<
    Array<{
      code: string;
      status: string;
      partnerId: number | null;
      isCreator: boolean;
    }>
  > {
    const uid = userId;
    const pairs = await this.prisma.pair.findMany({
      where: { OR: [{ userId1: uid }, { userId2: uid }] },
      orderBy: { createdAt: 'desc' },
    });
    return pairs.map((pair) => {
      const isCreator = pair.userId1 === uid;
      const partnerId = isCreator
        ? pair.userId2
          ? Number(pair.userId2)
          : null
        : Number(pair.userId1);
      return { code: pair.code, status: pair.status, isCreator, partnerId };
    });
  }

  async createPairInvite(userId: bigint): Promise<string> {
    const existing = await this.prisma.pair.findFirst({
      where: { userId1: userId, status: 'pending' },
    });
    if (existing) return existing.code;
    const code = randomBytes(6).toString('hex').toUpperCase();
    await this.prisma.pair.create({ data: { code, userId1: userId } });
    return code;
  }

  async joinPair(userId: bigint, code: string): Promise<boolean> {
    const uid = userId;
    const pair = await this.prisma.pair.findUnique({ where: { code } });
    if (
      !pair ||
      pair.status !== 'pending' ||
      pair.userId1 === uid ||
      pair.userId2 === uid
    )
      return false;
    // Conditional update — atomic at the DB level. If two users race to join
    // the same code, only the one whose UPDATE still matches `pending` + empty
    // slot wins; the loser gets count 0.
    const res = await this.prisma.pair.updateMany({
      where: { code, status: 'pending', userId2: null },
      data: { userId2: uid, status: 'active' },
    });
    return res.count === 1;
  }

  async cancelAllPreReminders(): Promise<number> {
    const result = await this.prisma.scheduledNotification.updateMany({
      where: { type: 'pre_reminder', sentAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    return result.count;
  }

  async leavePair(userId: bigint, code: string): Promise<void> {
    const uid = userId;
    const pair = await this.prisma.pair.findUnique({ where: { code } });
    if (!pair) return;
    if (pair.userId1 === uid) {
      await this.prisma.pair.delete({ where: { code } });
    } else if (pair.userId2 === uid) {
      await this.prisma.pair.update({
        where: { code },
        data: { userId2: null, status: 'pending' },
      });
    }
  }

  // ─── Practices ────────────────────────────────────────────────────────────

  async getPractices(userId: bigint, needId: string) {
    const rows = await this.prisma.userPractice.findMany({
      where: { userId, needId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ ...r, text: decrypt(r.text) ?? r.text }));
  }

  async addPractice(userId: bigint, needId: string, text: string) {
    return this.prisma.userPractice.create({
      data: { userId, needId, text: encrypt(text) ?? text },
    });
  }

  async deletePractice(userId: bigint, id: number) {
    await this.prisma.userPractice.deleteMany({
      where: { id, userId },
    });
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  async createPlan(
    userId: bigint,
    needId: string,
    practiceText: string,
    scheduledDate: string,
    reminderUtcHour?: number,
  ) {
    const row = await this.prisma.practicePlan.create({
      data: {
        userId,
        needId,
        practiceText: encrypt(practiceText) ?? practiceText,
        scheduledDate,
        reminderUtcHour,
      },
    });
    return { ...row, practiceText }; // return plaintext to caller
  }

  async checkinPlan(userId: bigint, id: number, done: boolean) {
    await this.prisma.practicePlan.updateMany({
      where: { id, userId },
      data: { done, checkedAt: new Date() },
    });
  }

  async getPendingPlans(userId: bigint, date: string) {
    const rows = await this.prisma.practicePlan.findMany({
      where: { userId, scheduledDate: { gte: date }, done: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      ...r,
      practiceText: decrypt(r.practiceText) ?? r.practiceText,
    }));
  }

  async getPlanHistory(userId: bigint, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const sinceStr = since.toISOString().split('T')[0];
    const rows = await this.prisma.practicePlan.findMany({
      where: { userId, scheduledDate: { gte: sinceStr } },
      orderBy: { scheduledDate: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      practiceText: decrypt(r.practiceText) ?? r.practiceText,
    }));
  }

  async getMissedPlans(userId: bigint, date: string) {
    const rows = await this.prisma.practicePlan.findMany({
      where: { userId, scheduledDate: date, done: null },
    });
    return rows.map((r) => ({
      ...r,
      practiceText: decrypt(r.practiceText) ?? r.practiceText,
    }));
  }

  async getChildhoodRatings(
    userId: bigint,
  ): Promise<Partial<Record<string, number>>> {
    const rows = await this.prisma.childhoodRating.findMany({
      where: { userId },
    });
    const result: Partial<Record<string, number>> = {};
    for (const row of rows) result[row.needId] = row.value;
    return result;
  }

  async saveChildhoodRatings(
    userId: bigint,
    ratings: Record<string, number>,
  ): Promise<void> {
    await this.prisma.$transaction(
      Object.entries(ratings).map(([needId, value]) =>
        this.prisma.childhoodRating.upsert({
          where: { userId_needId: { userId, needId } },
          create: { userId, needId, value },
          update: { value },
        }),
      ),
    );
  }

  async getYsqResult(
    userId: bigint,
  ): Promise<{ answers: number[]; completedAt: Date } | null> {
    const r = await this.prisma.ysqResult.findUnique({ where: { userId } });
    if (!r) return null;
    return { answers: r.answers as number[], completedAt: r.completedAt };
  }

  async deleteYsqResult(userId: bigint): Promise<void> {
    await this.prisma.ysqResult.deleteMany({ where: { userId } });
  }

  async saveYsqResult(userId: bigint, answers: number[]): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ysqResult.upsert({
        where: { userId },
        update: { answers, completedAt: now },
        create: { userId, answers },
      }),
      this.prisma.ysqResultHistory.create({
        data: { userId, answers, completedAt: now },
      }),
    ]);
  }

  async getYsqHistory(
    userId: bigint,
  ): Promise<Array<{ id: number; completedAt: Date; answers: number[] }>> {
    const rows = await this.prisma.ysqResultHistory.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      completedAt: r.completedAt,
      answers: r.answers as number[],
    }));
  }

  private static readonly SCHEMA_NOTE_SCHEMA: EncryptSchema = {
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
  private static readonly MODE_NOTE_SCHEMA: EncryptSchema = {
    strings: ['triggers', 'feelings', 'thoughts', 'needs', 'behavior'],
  };

  async getSchemaNote(userId: bigint, schemaId: string) {
    const row = await this.prisma.userSchemaNote.findUnique({
      where: { userId_schemaId: { userId, schemaId } },
    });
    return row ? decryptRecord(row, BotService.SCHEMA_NOTE_SCHEMA) : null;
  }

  async getSchemaNotes(userId: bigint) {
    const rows = await this.prisma.userSchemaNote.findMany({
      where: { userId },
    });
    return rows.map((r) => decryptRecord(r, BotService.SCHEMA_NOTE_SCHEMA));
  }

  async upsertSchemaNote(
    userId: bigint,
    schemaId: string,
    data: {
      triggers?: string;
      feelings?: string;
      thoughts?: string;
      origins?: string;
      reality?: string;
      healthyView?: string;
      behavior?: string;
    },
  ) {
    const enc = encryptRecord(data, BotService.SCHEMA_NOTE_SCHEMA);
    const res = await this.prisma.userSchemaNote.upsert({
      where: { userId_schemaId: { userId, schemaId } },
      update: enc,
      create: { userId, schemaId, ...enc },
    });
    // Заполненная карточка = схема в коллекции юзера, иначе её не найти в «Моих записях».
    await this.addToMyList(userId, 'mySchemaIds', schemaId);
    return res;
  }

  // Добавляет id в зашифрованный json-массив профиля (mySchemaIds/myModeIds), если его там ещё нет.
  private async addToMyList(
    userId: bigint,
    field: 'mySchemaIds' | 'myModeIds',
    id: string,
  ) {
    // Read-modify-write по денормализованному зашифрованному списку — в
    // транзакции (аудит 2026-07, 2.2): конкурентные upsert'ы разных карточек
    // одного юзера гонялись за одним прочитанным списком → lost update.
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.findUnique({
        where: { id: userId },
        select: { [field]: true } as any,
      });
      if (!row) return;
      const dec = decryptRecord(row as any, { jsonArrays: [field] }) as Record<
        string,
        unknown
      >;
      const list = Array.isArray(dec[field]) ? (dec[field] as string[]) : [];
      if (list.includes(id)) return;
      const enc = encryptRecord(
        { [field]: [...list, id] },
        { jsonArrays: [field] },
      );
      await tx.user.update({ where: { id: userId }, data: enc as any });
    });
  }

  async getModeNote(userId: bigint, modeId: string) {
    const row = await this.prisma.userModeNote.findUnique({
      where: { userId_modeId: { userId, modeId } },
    });
    return row ? decryptRecord(row, BotService.MODE_NOTE_SCHEMA) : null;
  }

  async getModeNotes(userId: bigint) {
    const rows = await this.prisma.userModeNote.findMany({ where: { userId } });
    return rows.map((r) => decryptRecord(r, BotService.MODE_NOTE_SCHEMA));
  }

  async upsertModeNote(
    userId: bigint,
    modeId: string,
    data: {
      triggers?: string;
      feelings?: string;
      thoughts?: string;
      needs?: string;
      behavior?: string;
    },
  ) {
    const enc = encryptRecord(data, BotService.MODE_NOTE_SCHEMA);
    const res = await this.prisma.userModeNote.upsert({
      where: { userId_modeId: { userId, modeId } },
      update: enc,
      create: { userId, modeId, ...enc },
    });
    await this.addToMyList(userId, 'myModeIds', modeId);
    return res;
  }

  async updateName(userId: bigint, name: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: name },
    });
  }

  async setRole(userId: bigint, role: 'CLIENT' | 'THERAPIST'): Promise<void> {
    // When promoting to THERAPIST also enable therapistMode by default
    // (was client-side auto-enable via localStorage check)
    await this.prisma.user.update({
      where: { id: userId },
      data: { role, therapistMode: role === 'THERAPIST' },
    });
  }

  async getUserRole(userId: bigint): Promise<'CLIENT' | 'THERAPIST'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role ?? 'CLIENT';
  }

  // ── Belief checks ────────────────────────────────────────────────────────────

  async getBeliefChecks(userId: bigint) {
    const rows = await this.prisma.userBeliefCheck.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => ({
      ...r,
      belief: decrypt(r.belief) ?? r.belief,
      evidenceFor: decryptJson<string[]>(r.evidenceFor) ?? [],
      evidenceAgainst: decryptJson<string[]>(r.evidenceAgainst) ?? [],
      reframe: decrypt(r.reframe),
    }));
  }

  async createBeliefCheck(
    userId: bigint,
    data: {
      belief: string;
      evidenceFor: string[];
      evidenceAgainst: string[];
      reframe?: string;
    },
  ) {
    return this.prisma.userBeliefCheck.create({
      data: {
        userId,
        belief: encrypt(data.belief) ?? data.belief,
        evidenceFor:
          encryptJson(data.evidenceFor) ?? JSON.stringify(data.evidenceFor),
        evidenceAgainst:
          encryptJson(data.evidenceAgainst) ??
          JSON.stringify(data.evidenceAgainst),
        reframe: encrypt(data.reframe),
      },
    });
  }

  async deleteBeliefCheck(userId: bigint, id: number) {
    return this.prisma.userBeliefCheck.deleteMany({ where: { id, userId } });
  }

  // ── Letters ───────────────────────────────────────────────────────────────────

  async getLetters(userId: bigint) {
    const rows = await this.prisma.userLetter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => ({ ...r, text: decrypt(r.text) ?? r.text }));
  }

  async createLetter(userId: bigint, text: string) {
    const row = await this.prisma.userLetter.create({
      data: { userId, text: encrypt(text) ?? text },
    });
    return { ...row, text };
  }

  async deleteLetter(userId: bigint, id: number) {
    return this.prisma.userLetter.deleteMany({ where: { id, userId } });
  }

  // ── Safe place ────────────────────────────────────────────────────────────────

  async getSafePlace(userId: bigint) {
    const row = await this.prisma.userSafePlace.findUnique({
      where: { userId },
    });
    if (!row) return null;
    return { ...row, description: decrypt(row.description) ?? row.description };
  }

  async upsertSafePlace(userId: bigint, description: string) {
    const enc = encrypt(description) ?? description;
    const row = await this.prisma.userSafePlace.upsert({
      where: { userId },
      update: { description: enc },
      create: { userId, description: enc },
    });
    return { ...row, description };
  }

  // ── Flashcards ────────────────────────────────────────────────────────────────

  async getFlashcards(userId: bigint) {
    const rows = await this.prisma.userFlashcard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => ({
      ...r,
      reflection: decrypt(r.reflection),
      action: decrypt(r.action),
    }));
  }

  async createFlashcard(
    userId: bigint,
    data: {
      modeId: string;
      needId: string;
      reflection?: string;
      action?: string;
    },
  ) {
    const row = await this.prisma.userFlashcard.create({
      data: {
        userId,
        modeId: data.modeId,
        needId: data.needId,
        reflection: encrypt(data.reflection),
        action: encrypt(data.action),
      },
    });
    return {
      ...row,
      reflection: data.reflection ?? null,
      action: data.action ?? null,
    };
  }

  async deleteFlashcard(userId: bigint, id: number) {
    return this.prisma.userFlashcard.deleteMany({ where: { id, userId } });
  }

  // ── Therapist: client notes access ───────────────────────────────────────────

  async getClientSchemaNotes(therapistId: bigint, clientId: bigint) {
    const [rel, client] = await Promise.all([
      this.prisma.therapyRelation.findFirst({
        where: { therapistId, clientId, status: 'active' },
      }),
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: { therapistShareCards: true },
      }),
    ]);
    if (!rel) return null;
    if (client?.therapistShareCards === false) return [];
    return this.prisma.userSchemaNote.findMany({ where: { userId: clientId } });
  }

  async getClientModeNotes(therapistId: bigint, clientId: bigint) {
    const [rel, client] = await Promise.all([
      this.prisma.therapyRelation.findFirst({
        where: { therapistId, clientId, status: 'active' },
      }),
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: { therapistShareCards: true },
      }),
    ]);
    if (!rel) return null;
    if (client?.therapistShareCards === false) return [];
    return this.prisma.userModeNote.findMany({ where: { userId: clientId } });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  async deleteAllUserData(userId: bigint): Promise<void> {
    const uid = userId;
    // HARD delete — right-to-erasure. We tear out every row that references
    // this user, including auth providers, web sessions, therapist requests,
    // and finally the User row itself. NO soft-delete fallback.
    //
    // After the transaction we run VACUUM on the touched tables (outside the
    // transaction — VACUUM can't run inside one). This reclaims dead tuples
    // so the data is physically overwriteable by Postgres faster.
    await this.prisma.$transaction([
      // All user-owned tables (USER_DATA_TABLES registry above).
      ...USER_DATA_TABLES.map((table) =>
        (this.prisma[table] as any).deleteMany({ where: { userId: uid } }),
      ),
      // Clinical rows about a person: remove when EITHER side deletes account.
      // clientId matters no less than therapistId — right-to-erasure клиента
      // включает конспектуализацию и заметки терапевта О НЁМ (аудит 2026-07, D-1).
      this.prisma.clientConceptualization.deleteMany({
        where: { OR: [{ therapistId: uid }, { clientId: uid }] },
      }),
      this.prisma.therapistNote.deleteMany({
        where: { OR: [{ therapistId: uid }, { clientId: uid }] },
      }),
      this.prisma.therapyRelation.deleteMany({
        where: { OR: [{ therapistId: uid }, { clientId: uid }] },
      }),
      // Mode maps (about a client, created by a therapist) — remove if either side leaves.
      (this.prisma as any).modeMap.deleteMany({
        where: { OR: [{ therapistId: uid }, { clientId: uid }] },
      }),
      (this.prisma as any).therapistCustomMode.deleteMany({
        where: { therapistId: uid },
      }),
      // Pairs (two refs).
      this.prisma.pair.deleteMany({
        where: { OR: [{ userId1: uid }, { userId2: uid }] },
      }),
      // Auth: providers + web sessions + therapist requests.
      (this.prisma as any).authProvider.deleteMany({ where: { userId: uid } }),
      (this.prisma as any).webSession.deleteMany({ where: { userId: uid } }),
      (this.prisma as any).therapistRequest.deleteMany({
        where: { userId: uid },
      }),
      // Recurring subscriptions: for Telegram users userId === telegramId, so
      // remove (and stop billing) any subscription tied to this person. Charges
      // cascade-delete via the FK. (Web-only subs without telegramId aren't
      // account-linked — managed by their own cancel token.)
      (this.prisma as any).subscription.deleteMany({
        where: { telegramId: uid },
      }),
      // Finally — the user row itself.
      this.prisma.user.delete({ where: { id: uid } }),
    ]);
    // Async VACUUM on the affected tables only (non-blocking, no FULL).
    // Scope to User table and key user-data tables — avoids a full-DB scan.
    this.prisma
      .$executeRawUnsafe('VACUUM ANALYZE "User"')
      .catch((e) =>
        this.logger.warn(`Post-delete VACUUM failed: ${(e as Error).message}`),
      );
  }
}
