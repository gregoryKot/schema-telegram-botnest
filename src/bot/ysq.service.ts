import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Тест на схемы — прогресс прохождения и итоговые результаты.
@Injectable()
export class YsqService {
  constructor(private readonly prisma: PrismaService) {}

  async getYsqProgress(
    userId: bigint,
  ): Promise<{ answers: number[]; page: number } | null> {
    const r = await this.prisma.ysqProgress.findUnique({ where: { userId } });
    if (!r) return null;
    return { answers: r.answers as number[], page: r.page };
  }

  async saveYsqProgress(
    userId: bigint,
    answers: number[],
    page: number,
  ): Promise<void> {
    await this.prisma.ysqProgress.upsert({
      where: { userId },
      update: { answers, page, updatedAt: new Date() },
      create: { userId, answers, page },
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
    return { answers: r.answers as number[], completedAt: r.completedAt };
  }

  async deleteYsqResult(userId: bigint): Promise<void> {
    await this.prisma.ysqResult.deleteMany({ where: { userId } });
  }

  async saveYsqResult(userId: bigint, answers: number[]): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ysqResult.upsert({
        where: { userId },
        update: { answers, completedAt: now },
        create: { userId, answers },
      }),
      this.prisma.ysqResultHistory.create({
        data: { userId, answers, completedAt: now },
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
      answers: r.answers as number[],
    }));
  }
}
