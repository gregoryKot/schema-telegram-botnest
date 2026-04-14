import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { encrypt, decrypt, encryptJson, decryptJson } from '../utils/crypto';

export interface EmotionEntry {
  id: string;
  intensity: number; // 1-5
}

@Injectable()
export class DiaryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Schema Diary ─────────────────────────────────────────────────────────

  async createSchemaDiaryEntry(userId: bigint, data: {
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
    const row = await this.prisma.schemaDiaryEntry.create({
      data: {
        userId,
        trigger: encrypt(data.trigger) ?? data.trigger,
        emotions: (encryptJson(data.emotions) ?? JSON.stringify(data.emotions)) as any,
        thoughts: encrypt(data.thoughts),
        bodyFeelings: encrypt(data.bodyFeelings),
        actualBehavior: encrypt(data.actualBehavior),
        schemaIds: data.schemaIds as any,
        schemaOrigin: encrypt(data.schemaOrigin),
        healthyView: encrypt(data.healthyView),
        realProblems: encrypt(data.realProblems),
        excessiveReactions: encrypt(data.excessiveReactions),
        healthyBehavior: encrypt(data.healthyBehavior),
      },
    });
    // Return plaintext so caller doesn't receive encrypted strings
    return {
      ...row,
      trigger: data.trigger,
      emotions: data.emotions,
      thoughts: data.thoughts ?? null,
      bodyFeelings: data.bodyFeelings ?? null,
      actualBehavior: data.actualBehavior ?? null,
      schemaOrigin: data.schemaOrigin ?? null,
      healthyView: data.healthyView ?? null,
      realProblems: data.realProblems ?? null,
      excessiveReactions: data.excessiveReactions ?? null,
      healthyBehavior: data.healthyBehavior ?? null,
    };
  }

  async getSchemaDiaryEntries(userId: bigint, limit = 30) {
    const rows = await this.prisma.schemaDiaryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(r => ({
      ...r,
      trigger: decrypt(r.trigger) ?? r.trigger,
      emotions: decryptJson<EmotionEntry[]>(r.emotions as unknown as string) ?? r.emotions,
      thoughts: decrypt(r.thoughts),
      bodyFeelings: decrypt(r.bodyFeelings),
      actualBehavior: decrypt(r.actualBehavior),
      schemaOrigin: decrypt(r.schemaOrigin),
      healthyView: decrypt(r.healthyView),
      realProblems: decrypt(r.realProblems),
      excessiveReactions: decrypt(r.excessiveReactions),
      healthyBehavior: decrypt(r.healthyBehavior),
    }));
  }

  deleteSchemaDiaryEntry(userId: bigint, id: number) {
    return this.prisma.schemaDiaryEntry.deleteMany({ where: { id, userId } });
  }

  // ─── Mode Diary ───────────────────────────────────────────────────────────

  async createModeDiaryEntry(userId: bigint, data: {
    modeId: string;
    situation: string;
    thoughts?: string;
    feelings?: string;
    bodyFeelings?: string;
    actions?: string;
    actualNeed?: string;
    childhoodMemories?: string;
  }) {
    const row = await this.prisma.modeDiaryEntry.create({
      data: {
        userId,
        modeId: data.modeId,
        situation: encrypt(data.situation) ?? data.situation,
        thoughts: encrypt(data.thoughts),
        feelings: encrypt(data.feelings),
        bodyFeelings: encrypt(data.bodyFeelings),
        actions: encrypt(data.actions),
        actualNeed: encrypt(data.actualNeed),
        childhoodMemories: encrypt(data.childhoodMemories),
      },
    });
    // Return plaintext so caller doesn't receive encrypted strings
    return {
      ...row,
      situation: data.situation,
      thoughts: data.thoughts ?? null,
      feelings: data.feelings ?? null,
      bodyFeelings: data.bodyFeelings ?? null,
      actions: data.actions ?? null,
      actualNeed: data.actualNeed ?? null,
      childhoodMemories: data.childhoodMemories ?? null,
    };
  }

  async getModeDiaryEntries(userId: bigint, limit = 30) {
    const rows = await this.prisma.modeDiaryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(r => ({
      ...r,
      situation: decrypt(r.situation) ?? r.situation,
      thoughts: decrypt(r.thoughts),
      feelings: decrypt(r.feelings),
      bodyFeelings: decrypt(r.bodyFeelings),
      actions: decrypt(r.actions),
      actualNeed: decrypt(r.actualNeed),
      childhoodMemories: decrypt(r.childhoodMemories),
    }));
  }

  deleteModeDiaryEntry(userId: bigint, id: number) {
    return this.prisma.modeDiaryEntry.deleteMany({ where: { id, userId } });
  }

  // ─── Gratitude Diary ──────────────────────────────────────────────────────

  async upsertGratitudeDiaryEntry(userId: bigint, date: string, items: string[]) {
    const enc = (encryptJson(items) ?? JSON.stringify(items)) as any;
    const row = await this.prisma.gratitudeDiaryEntry.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, items: enc },
      update: { items: enc },
    });
    return { ...row, items }; // return plaintext items
  }

  async getGratitudeDiaryEntries(userId: bigint, limit = 30) {
    const rows = await this.prisma.gratitudeDiaryEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
    return rows.map(r => ({
      ...r,
      items: decryptJson<string[]>(r.items as unknown as string) ?? r.items,
    }));
  }

  deleteGratitudeDiaryEntry(userId: bigint, id: number) {
    return this.prisma.gratitudeDiaryEntry.deleteMany({ where: { id, userId } });
  }
}
