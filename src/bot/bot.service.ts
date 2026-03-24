import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'] as const;
export type NeedId = typeof NEED_IDS[number];

export interface Need {
  id: NeedId;
  emoji: string;       // для сводки и идентификации
  title: string;       // короткое — для кнопок
  fullTitle: string;   // полное — для экрана оценки и FAQ
  chartLabel: string;  // для диаграммы (без эмодзи)
}

@Injectable()
export class BotService {
  private readonly needs: Need[] = [
    {
      id: 'attachment',
      emoji: '🤝',
      title: '🤝 Привязанность',
      fullTitle: 'Безопасная привязанность\n(безопасность, стабильность, забота, принятие)',
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

  private localDateString(tzOffsetHours = 0, base = new Date()): string {
    const local = new Date(base.getTime() + tzOffsetHours * 3600_000);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, '0');
    const d = String(local.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private async userTzOffset(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { notifyTzOffset: true },
    });
    return user?.notifyTzOffset ?? 2;
  }

  async registerUser(userId: number, firstName?: string, tzOffset?: number) {
    const validTz = typeof tzOffset === 'number' && Number.isFinite(tzOffset) && tzOffset >= -12 && tzOffset <= 14;
    await this.prisma.user.upsert({
      where: { id: BigInt(userId) },
      update: { ...(firstName ? { firstName } : {}), botBlockedAt: null, deletedAt: null },
      create: { id: BigInt(userId), firstName, ...(validTz ? { notifyTzOffset: Math.round(tzOffset!) } : {}) },
    });
  }

  async getUserFirstName(userId: number): Promise<string | null> {
    const u = await this.prisma.user.findUnique({ where: { id: BigInt(userId) }, select: { firstName: true } });
    return u?.firstName ?? null;
  }

  async acceptDisclaimer(userId: number): Promise<void> {
    await this.prisma.user.update({ where: { id: BigInt(userId) }, data: { disclaimerAccepted: true } });
  }

  async hasAcceptedDisclaimer(userId: number): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: BigInt(userId) }, select: { disclaimerAccepted: true } });
    return u?.disclaimerAccepted ?? false;
  }

  async getYsqProgress(userId: number): Promise<{ answers: number[]; page: number } | null> {
    const r = await this.prisma.ysqProgress.findUnique({ where: { userId: BigInt(userId) } });
    if (!r) return null;
    return { answers: r.answers as number[], page: r.page };
  }

  async saveYsqProgress(userId: number, answers: number[], page: number): Promise<void> {
    const uid = BigInt(userId);
    await this.prisma.ysqProgress.upsert({
      where: { userId: uid },
      update: { answers, page, updatedAt: new Date() },
      create: { userId: uid, answers, page },
    });
  }

  async deleteYsqProgress(userId: number): Promise<void> {
    await this.prisma.ysqProgress.deleteMany({ where: { userId: BigInt(userId) } });
  }

  async getUserSettings(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { notifyEnabled: true, notifyUtcHour: true, notifyTzOffset: true, notifyReminderEnabled: true, pairCardDismissed: true },
    });
  }

  async updateUserSettings(userId: number, data: { notifyEnabled?: boolean; notifyUtcHour?: number; notifyTzOffset?: number; notifyReminderEnabled?: boolean; pairCardDismissed?: boolean }) {
    await this.prisma.user.update({ where: { id: BigInt(userId) }, data });
  }

  async getNote(userId: number, date: string): Promise<{ text: string | null; tags: string[] }> {
    const note = await this.prisma.note.findUnique({
      where: { userId_date: { userId: BigInt(userId), date } },
    });
    return {
      text: note?.text ?? null,
      tags: note?.tags ? note.tags.split(',').filter(Boolean) : [],
    };
  }

  async saveNote(userId: number, date: string, text: string, tags?: string[]) {
    const tagsStr = tags ? tags.join(',') : '';
    await this.prisma.note.upsert({
      where: { userId_date: { userId: BigInt(userId), date } },
      update: { text, tags: tagsStr },
      create: { userId: BigInt(userId), date, text, tags: tagsStr },
    });
  }

  async getUsersToNotify(utcHour: number): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: { notifyEnabled: true, notifyUtcHour: utcHour },
      select: { id: true },
    });
    return users.map((u) => Number(u.id));
  }

  async markUserBlocked(userId: number): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: BigInt(userId), botBlockedAt: null },
      data: { botBlockedAt: new Date() },
    });
  }

  async getAllUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return users.map((u) => Number(u.id));
  }

  async getAllUsersWithSettings(): Promise<Array<{ id: number; notifyUtcHour: number; notifyTzOffset: number; notifyReminderEnabled: boolean }>> {
    const users = await this.prisma.user.findMany({
      where: { notifyEnabled: true, botBlockedAt: null, deletedAt: null },
      select: { id: true, notifyUtcHour: true, notifyTzOffset: true, notifyReminderEnabled: true },
    });
    return users.map((u) => ({ ...u, id: Number(u.id) }));
  }

  async saveRating(userId: number, needId: NeedId, value: number, date?: string) {
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new Error('Rating must be integer 0..10');
    }
    const uid = BigInt(userId);
    const dt = date ?? this.localDateString(await this.userTzOffset(userId));
    await this.prisma.rating.upsert({
      where: { userId_date_needId: { userId: uid, date: dt, needId } },
      update: { value },
      create: { userId: uid, date: dt, needId, value },
    });
  }

  async getRatings(userId: number, date?: string) {
    const dt = date ?? this.localDateString(await this.userTzOffset(userId));
    const rows = await this.prisma.rating.findMany({
      where: { userId: BigInt(userId), date: dt },
    });
    return Object.fromEntries(rows.map((r) => [r.needId, r.value])) as Partial<Record<NeedId, number>>;
  }

  async getUserPair(userId: number): Promise<{ code: string; status: string; isCreator: boolean; partnerId: number | null } | null> {
    const uid = BigInt(userId);
    const pair = await this.prisma.pair.findFirst({
      where: { OR: [{ userId1: uid }, { userId2: uid }] },
      orderBy: { createdAt: 'desc' },
    });
    if (!pair) return null;
    const isCreator = pair.userId1 === uid;
    const partnerId = isCreator
      ? (pair.userId2 ? Number(pair.userId2) : null)
      : Number(pair.userId1);
    return { code: pair.code, status: pair.status, isCreator, partnerId };
  }

  async getUserPairs(userId: number): Promise<Array<{
    code: string;
    status: string;
    partnerId: number | null;
    isCreator: boolean;
  }>> {
    const uid = BigInt(userId);
    const pairs = await this.prisma.pair.findMany({
      where: { OR: [{ userId1: uid }, { userId2: uid }] },
      orderBy: { createdAt: 'desc' },
    });
    return pairs.map(pair => {
      const isCreator = pair.userId1 === uid;
      const partnerId = isCreator
        ? (pair.userId2 ? Number(pair.userId2) : null)
        : Number(pair.userId1);
      return { code: pair.code, status: pair.status, isCreator, partnerId };
    });
  }

  async createPairInvite(userId: number): Promise<string> {
    const uid = BigInt(userId);
    const existing = await this.prisma.pair.findFirst({ where: { userId1: uid, status: 'pending' } });
    if (existing) return existing.code;
    const code = Math.random().toString(36).slice(2, 9).toUpperCase();
    await this.prisma.pair.create({ data: { code, userId1: uid } });
    return code;
  }

  async joinPair(userId: number, code: string): Promise<boolean> {
    const uid = BigInt(userId);
    const pair = await this.prisma.pair.findUnique({ where: { code } });
    if (!pair || pair.status !== 'pending' || pair.userId1 === uid || pair.userId2 === uid) return false;
    await this.prisma.pair.update({ where: { code }, data: { userId2: uid, status: 'active' } });
    return true;
  }

  async cancelAllPreReminders(): Promise<number> {
    const result = await this.prisma.scheduledNotification.updateMany({
      where: { type: 'pre_reminder', sentAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    return result.count;
  }

  async leavePair(userId: number, code: string): Promise<void> {
    const uid = BigInt(userId);
    const pair = await this.prisma.pair.findUnique({ where: { code } });
    if (!pair) return;
    if (pair.userId1 === uid) {
      await this.prisma.pair.delete({ where: { code } });
    } else if (pair.userId2 === uid) {
      await this.prisma.pair.update({ where: { code }, data: { userId2: null, status: 'pending' } });
    }
  }

  // ─── Practices ────────────────────────────────────────────────────────────

  async getPractices(userId: number, needId: string) {
    return this.prisma.userPractice.findMany({
      where: { userId: BigInt(userId), needId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addPractice(userId: number, needId: string, text: string) {
    return this.prisma.userPractice.create({
      data: { userId: BigInt(userId), needId, text },
    });
  }

  async deletePractice(userId: number, id: number) {
    await this.prisma.userPractice.deleteMany({
      where: { id, userId: BigInt(userId) },
    });
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  async getPendingPlan(userId: number, date: string) {
    return this.prisma.practicePlan.findFirst({
      where: { userId: BigInt(userId), scheduledDate: date, done: null },
    });
  }

  async createPlan(userId: number, needId: string, practiceText: string, scheduledDate: string, reminderUtcHour?: number) {
    return this.prisma.practicePlan.create({
      data: { userId: BigInt(userId), needId, practiceText, scheduledDate, reminderUtcHour },
    });
  }

  async checkinPlan(userId: number, id: number, done: boolean) {
    await this.prisma.practicePlan.updateMany({
      where: { id, userId: BigInt(userId) },
      data: { done, checkedAt: new Date() },
    });
  }

  async getPendingPlans(userId: number, date: string) {
    return this.prisma.practicePlan.findMany({
      where: { userId: BigInt(userId), scheduledDate: { gte: date }, done: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPlanHistory(userId: number, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const sinceStr = since.toISOString().split('T')[0];
    return this.prisma.practicePlan.findMany({
      where: { userId: BigInt(userId), scheduledDate: { gte: sinceStr } },
      orderBy: { scheduledDate: 'desc' },
    });
  }

  async getMissedPlans(userId: number, date: string) {
    return this.prisma.practicePlan.findMany({
      where: { userId: BigInt(userId), scheduledDate: date, done: null },
    });
  }

  async getChildhoodRatings(userId: number): Promise<Partial<Record<string, number>>> {
    const rows = await this.prisma.childhoodRating.findMany({ where: { userId: BigInt(userId) } });
    const result: Partial<Record<string, number>> = {};
    for (const row of rows) result[row.needId] = row.value;
    return result;
  }

  async saveChildhoodRatings(userId: number, ratings: Record<string, number>): Promise<void> {
    await Promise.all(
      Object.entries(ratings).map(([needId, value]) =>
        this.prisma.childhoodRating.upsert({
          where: { userId_needId: { userId: BigInt(userId), needId } },
          create: { userId: BigInt(userId), needId, value },
          update: { value },
        })
      )
    );
  }

  async getYsqResult(userId: number): Promise<{ answers: number[]; completedAt: Date } | null> {
    const r = await this.prisma.ysqResult.findUnique({ where: { userId: BigInt(userId) } });
    if (!r) return null;
    return { answers: r.answers as number[], completedAt: r.completedAt };
  }

  async deleteYsqResult(userId: number): Promise<void> {
    await this.prisma.ysqResult.deleteMany({ where: { userId: BigInt(userId) } });
  }

  async saveYsqResult(userId: number, answers: number[]): Promise<void> {
    const uid = BigInt(userId);
    await this.prisma.ysqResult.upsert({
      where: { userId: uid },
      update: { answers, completedAt: new Date() },
      create: { userId: uid, answers },
    });
  }

  async deleteAllUserData(userId: number): Promise<void> {
    const uid = BigInt(userId);
    await this.prisma.$transaction([
      this.prisma.rating.deleteMany({ where: { userId: uid } }),
      this.prisma.note.deleteMany({ where: { userId: uid } }),
      this.prisma.userPractice.deleteMany({ where: { userId: uid } }),
      this.prisma.practicePlan.deleteMany({ where: { userId: uid } }),
      this.prisma.childhoodRating.deleteMany({ where: { userId: uid } }),
      this.prisma.ysqResult.deleteMany({ where: { userId: uid } }),
      this.prisma.ysqProgress.deleteMany({ where: { userId: uid } }),
      this.prisma.scheduledNotification.deleteMany({ where: { userId: uid } }),
      this.prisma.pair.deleteMany({ where: { OR: [{ userId1: uid }, { userId2: uid }] } }),
      // Soft-delete: keep the user row so re-registration preserves original createdAt
      this.prisma.user.update({ where: { id: uid }, data: { deletedAt: new Date(), firstName: null, notifyEnabled: true, notifyUtcHour: 19, notifyTzOffset: 2, disclaimerAccepted: false, pairCardDismissed: false, botBlockedAt: null } }),
    ]);
  }
}
