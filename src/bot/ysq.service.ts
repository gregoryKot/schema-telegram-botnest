import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptJson, decryptJson } from '../utils/crypto';

// Тест на схемы — прогресс прохождения и итоговые результаты.
// Ответы (116 оценок 0–6) — клинический профиль схем, хранятся зашифрованным
// JSON-блобом в Json-колонке (как GratitudeDiaryEntry.items). Легаси-строки
// с plaintext-массивом читаются как есть (decrypt plaintext-tolerant).
const decAnswers = (v: unknown): number[] =>
  typeof v === 'string'
    ? (decryptJson<number[]>(v) ?? [])
    : ((v as number[]) ?? []);
const encAnswers = (answers: number[]): string =>
  encryptJson(answers) ?? JSON.stringify(answers);

@Injectable()
export class YsqService {
  constructor(private readonly prisma: PrismaService) {}

  async getYsqProgress(
    userId: bigint,
  ): Promise<{ answers: number[]; page: number } | null> {
    const r = await this.prisma.ysqProgress.findUnique({ where: { userId } });
    if (!r) return null;
    return { answers: decAnswers(r.answers), page: r.page };
  }

  async saveYsqProgress(
    userId: bigint,
    answers: number[],
    page: number,
  ): Promise<void> {
    const enc = encAnswers(answers);
    await this.prisma.ysqProgress.upsert({
      where: { userId },
      update: { answers: enc, page, updatedAt: new Date() },
      create: { userId, answers: enc, page },
    });
  }

  async deleteYsqProgress(userId: bigint): Promise<void> {
    await this.prisma.ysqProgress.deleteMany({ where: { userId } });
  }

  async getYsqResult(
    userId: bigint,
  ): Promise<{ answers: number[]; completedAt: Date } | null> {
    const r = await this.prisma.ysqResult.findUnique({ where: { userId } });
    if (!r) return null;
    return { answers: decAnswers(r.answers), completedAt: r.completedAt };
  }

  async deleteYsqResult(userId: bigint): Promise<void> {
    await this.prisma.ysqResult.deleteMany({ where: { userId } });
  }

  async saveYsqResult(userId: bigint, answers: number[]): Promise<void> {
    const now = new Date();
    const enc = encAnswers(answers);
    await this.prisma.$transaction([
      this.prisma.ysqResult.upsert({
        where: { userId },
        update: { answers: enc, completedAt: now },
        create: { userId, answers: enc },
      }),
      this.prisma.ysqResultHistory.create({
        data: { userId, answers: enc, completedAt: now },
      }),
    ]);
  }

  async getYsqHistory(
    userId: bigint,
  ): Promise<Array<{ id: number; completedAt: Date; answers: number[] }>> {
    const rows = await this.prisma.ysqResultHistory.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      completedAt: r.completedAt,
      answers: decAnswers(r.answers),
    }));
  }
}

// Единственный экспортируемый декодер для читателей YsqResult вне сервиса
// (profile.service, therapy-client-data.service) — чтобы tolerant-чтение
// не копипастилось (правило «одна механика — один компонент»).
export { decAnswers as decodeYsqAnswers };
