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

  private todayDateString(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async registerUser(userId: number) {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
  }

  async getAllUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return users.map((u) => u.id);
  }

  async saveRating(userId: number, needId: NeedId, value: number, date?: string) {
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new Error('Rating must be integer 0..10');
    }
    const dt = date ?? this.todayDateString();
    await this.prisma.rating.upsert({
      where: { userId_date_needId: { userId, date: dt, needId } },
      update: { value },
      create: { userId, date: dt, needId, value },
    });
  }

  async getRatings(userId: number, date?: string) {
    const dt = date ?? this.todayDateString();
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: dt },
    });
    return Object.fromEntries(rows.map((r) => [r.needId, r.value])) as Partial<Record<NeedId, number>>;
  }

  async getHistoryRatings(userId: number, days: number): Promise<Array<{ date: string; ratings: Partial<Record<NeedId, number>> }>> {
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.todayDateString(d);
    });
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: dates } },
    });
    const byDate = new Map<string, Partial<Record<NeedId, number>>>();
    for (const row of rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      byDate.get(row.date)![row.needId as NeedId] = row.value;
    }
    return dates.filter((d) => byDate.has(d)).map((d) => ({ date: d, ratings: byDate.get(d)! }));
  }

  async getLowStreakNeeds(userId: number, threshold: number, days: number): Promise<NeedId[]> {
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.todayDateString(d);
    });
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: dates } },
    });
    return NEED_IDS.filter((needId) => {
      const needRows = rows.filter((r) => r.needId === needId);
      return needRows.length === days && needRows.every((r) => r.value < threshold);
    });
  }
}
