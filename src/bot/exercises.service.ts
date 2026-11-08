import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, encryptJson } from '../utils/crypto';
import {
  deleteOwned,
  requireAffected,
  requireFound,
} from '../utils/require-affected';
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

  // Одна запись по id — её открывает «Мой путь» (R6: в списке только 30).
  async getBeliefCheck(userId: bigint, id: number) {
    const where = { id, userId };
    const row = this.prisma.userBeliefCheck.findFirst({ where });
    return readBeliefCheck(await requireFound(row));
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

  async getLetter(userId: bigint, id: number) {
    const where = { id, userId };
    return readLetter(
      await requireFound(this.prisma.userLetter.findFirst({ where })),
    );
  }

  async createLetter(userId: bigint, text: string) {
    const row = await this.prisma.userLetter.create({
      data: { userId, text: encrypt(text) ?? text },
    });
    return readLetter(row);
  }

  // «Изменить» после «Запечатать» правит то же письмо (QA 2026-11, З4).
  async updateLetter(userId: bigint, id: number, text: string) {
    const data = { text: encrypt(text) ?? text };
    const where = { id, userId };
    await requireAffected(
      this.prisma.userLetter.updateMany({ where, data }),
      'Letter',
    );
    const row = await this.prisma.userLetter.findFirst({ where });
    if (!row) throw new NotFoundException('Letter not found'); // удалено между запросами
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

  async getFlashcard(userId: bigint, id: number) {
    const where = { id, userId };
    const row = this.prisma.userFlashcard.findFirst({ where });
    return readFlashcard(await requireFound(row));
  }

  async deleteFlashcard(userId: bigint, id: number) {
    return deleteOwned(this.prisma.userFlashcard, id, userId);
  }
}
