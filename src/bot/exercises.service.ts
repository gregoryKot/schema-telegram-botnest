import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt, encryptJson, decryptJson } from '../utils/crypto';

// Упражнения: письма, безопасное место, флешкарты, проверка убеждений
// (belief checks) — самостоятельные user-owned инструменты без общей схемы.
@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

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
}
