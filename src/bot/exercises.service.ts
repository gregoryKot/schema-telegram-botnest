import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, encryptJson } from '../utils/crypto';
import { deleteOwned } from '../utils/require-affected';
import {
  readBeliefCheck,
  readFlashcard,
  readLetter,
  readSafePlace,
} from './encrypted-rows';

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
    return rows.map(readBeliefCheck);
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
    const row = await this.prisma.userBeliefCheck.create({
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
    return readBeliefCheck(row);
  }

  async deleteBeliefCheck(userId: bigint, id: number) {
    return deleteOwned(this.prisma.userBeliefCheck, id, userId);
  }

  // ── Letters ───────────────────────────────────────────────────────────────────

  async getLetters(userId: bigint) {
    const rows = await this.prisma.userLetter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map(readLetter);
  }

  async createLetter(userId: bigint, text: string) {
    const row = await this.prisma.userLetter.create({
      data: { userId, text: encrypt(text) ?? text },
    });
    return readLetter(row);
  }

  async deleteLetter(userId: bigint, id: number) {
    return deleteOwned(this.prisma.userLetter, id, userId);
  }

  // ── Safe place ────────────────────────────────────────────────────────────────

  async getSafePlace(userId: bigint) {
    const row = await this.prisma.userSafePlace.findUnique({
      where: { userId },
    });
    return row ? readSafePlace(row) : null;
  }

  async upsertSafePlace(userId: bigint, description: string) {
    const enc = encrypt(description) ?? description;
    const row = await this.prisma.userSafePlace.upsert({
      where: { userId },
      update: { description: enc },
      create: { userId, description: enc },
    });
    return readSafePlace(row);
  }

  // ── Flashcards ────────────────────────────────────────────────────────────────

  async getFlashcards(userId: bigint) {
    const rows = await this.prisma.userFlashcard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map(readFlashcard);
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
    return readFlashcard(row);
  }

  async deleteFlashcard(userId: bigint, id: number) {
    return deleteOwned(this.prisma.userFlashcard, id, userId);
  }
}
