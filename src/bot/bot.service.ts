import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const NEED_IDS = ['safety', 'attachment', 'autonomy', 'expression', 'limits', 'play'] as const;
export type NeedId = typeof NEED_IDS[number];

export interface Need {
  id: NeedId;
  title: string;
}

@Injectable()
export class BotService {
  private readonly needs: Need[] = [
    { id: 'safety', title: '🛡 Безопасность' },
    { id: 'attachment', title: '🤝 Привязанность' },
    { id: 'autonomy', title: '🚀 Автономия' },
    { id: 'expression', title: '💬 Выражение' },
    { id: 'limits', title: '⚖️ Самоконтроль' },
    { id: 'play', title: '🎉 Удовольствие' },
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
}
