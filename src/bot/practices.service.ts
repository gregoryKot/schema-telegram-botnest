import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../utils/crypto';

// Практики (пользовательские заметки-упражнения на потребность) и планы
// (запланированная практика на дату + чек-ин выполнения).
@Injectable()
export class PracticesService {
  constructor(private readonly prisma: PrismaService) {}

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
}
