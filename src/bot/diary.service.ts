import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EmotionEntry {
  id: string;
  intensity: number; // 1-5
}

@Injectable()
export class DiaryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Schema Diary ─────────────────────────────────────────────────────────

  createSchemaDiaryEntry(userId: bigint, data: {
    trigger: string;
    emotions: EmotionEntry[];
    thoughts?: string;
    bodyFeelings?: string;
    actualBehavior?: string;
    schemaIds: string[];
    schemaOrigin?: string;
    healthyView?: string;
    realProblems?: string;
    excessiveReactions?: string;
    healthyBehavior?: string;
  }) {
    return this.prisma.schemaDiaryEntry.create({ data: { userId, ...data } });
  }

  getSchemaDiaryEntries(userId: bigint, limit = 30) {
    return this.prisma.schemaDiaryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  deleteSchemaDiaryEntry(userId: bigint, id: number) {
    return this.prisma.schemaDiaryEntry.deleteMany({ where: { id, userId } });
  }

  // ─── Mode Diary ───────────────────────────────────────────────────────────

  createModeDiaryEntry(userId: bigint, data: {
    modeId: string;
    situation: string;
    thoughts?: string;
    feelings?: string;
    bodyFeelings?: string;
    actions?: string;
    actualNeed?: string;
    childhoodMemories?: string;
  }) {
    return this.prisma.modeDiaryEntry.create({ data: { userId, ...data } });
  }

  getModeDiaryEntries(userId: bigint, limit = 30) {
    return this.prisma.modeDiaryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  deleteModeDiaryEntry(userId: bigint, id: number) {
    return this.prisma.modeDiaryEntry.deleteMany({ where: { id, userId } });
  }

  // ─── Gratitude Diary ──────────────────────────────────────────────────────

  upsertGratitudeDiaryEntry(userId: bigint, date: string, items: string[]) {
    return this.prisma.gratitudeDiaryEntry.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, items },
      update: { items },
    });
  }

  getGratitudeDiaryEntries(userId: bigint, limit = 30) {
    return this.prisma.gratitudeDiaryEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  deleteGratitudeDiaryEntry(userId: bigint, id: number) {
    return this.prisma.gratitudeDiaryEntry.deleteMany({ where: { id, userId } });
  }
}
