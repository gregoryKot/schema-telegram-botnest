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
    return user?.notifyTzOffset ?? 0;
  }

  async registerUser(userId: number) {
    await this.prisma.user.upsert({
      where: { id: BigInt(userId) },
      update: {},
      create: { id: BigInt(userId) },
    });
  }

  async getUserSettings(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { notifyEnabled: true, notifyUtcHour: true, notifyTzOffset: true, notifyReminderEnabled: true },
    });
  }

  async updateUserSettings(userId: number, data: { notifyEnabled?: boolean; notifyUtcHour?: number; notifyTzOffset?: number; notifyReminderEnabled?: boolean }) {
    await this.prisma.user.update({ where: { id: BigInt(userId) }, data });
  }

  async getNote(userId: number, date: string): Promise<string | null> {
    const note = await this.prisma.note.findUnique({
      where: { userId_date: { userId: BigInt(userId), date } },
    });
    return note?.text ?? null;
  }

  async saveNote(userId: number, date: string, text: string) {
    await this.prisma.note.upsert({
      where: { userId_date: { userId: BigInt(userId), date } },
      update: { text },
      create: { userId: BigInt(userId), date, text },
    });
  }

  async getUsersToNotify(utcHour: number): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: { notifyEnabled: true, notifyUtcHour: utcHour },
      select: { id: true },
    });
    return users.map((u) => Number(u.id));
  }

  async getAllUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return users.map((u) => Number(u.id));
  }

  async getAllUsersWithSettings(): Promise<Array<{ id: number; notifyUtcHour: number; notifyTzOffset: number; notifyReminderEnabled: boolean }>> {
    const users = await this.prisma.user.findMany({
      where: { notifyEnabled: true },
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
}
