import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

// Пары (2 юзера сверяют трекеры друг друга) — коды приглашений, join/leave.
@Injectable()
export class PairsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPair(userId: bigint): Promise<{
    code: string;
    status: string;
    isCreator: boolean;
    partnerId: number | null;
  } | null> {
    const uid = userId;
    const pair = await this.prisma.pair.findFirst({
      where: { OR: [{ userId1: uid }, { userId2: uid }] },
      orderBy: { createdAt: 'desc' },
    });
    if (!pair) return null;
    const isCreator = pair.userId1 === uid;
    const partnerId = isCreator
      ? pair.userId2
        ? Number(pair.userId2)
        : null
      : Number(pair.userId1);
    return { code: pair.code, status: pair.status, isCreator, partnerId };
  }

  async getUserPairs(userId: bigint): Promise<
    Array<{
      code: string;
      status: string;
      partnerId: number | null;
      isCreator: boolean;
    }>
  > {
    const uid = userId;
    const pairs = await this.prisma.pair.findMany({
      where: { OR: [{ userId1: uid }, { userId2: uid }] },
      orderBy: { createdAt: 'desc' },
    });
    return pairs.map((pair) => {
      const isCreator = pair.userId1 === uid;
      const partnerId = isCreator
        ? pair.userId2
          ? Number(pair.userId2)
          : null
        : Number(pair.userId1);
      return { code: pair.code, status: pair.status, isCreator, partnerId };
    });
  }

  async createPairInvite(userId: bigint): Promise<string> {
    const existing = await this.prisma.pair.findFirst({
      where: { userId1: userId, status: 'pending' },
    });
    if (existing) return existing.code;
    const code = randomBytes(6).toString('hex').toUpperCase();
    await this.prisma.pair.create({ data: { code, userId1: userId } });
    return code;
  }

  async joinPair(userId: bigint, code: string): Promise<boolean> {
    const uid = userId;
    const pair = await this.prisma.pair.findUnique({ where: { code } });
    if (
      !pair ||
      pair.status !== 'pending' ||
      pair.userId1 === uid ||
      pair.userId2 === uid
    )
      return false;
    // Conditional update — atomic at the DB level. If two users race to join
    // the same code, only the one whose UPDATE still matches `pending` + empty
    // slot wins; the loser gets count 0.
    const res = await this.prisma.pair.updateMany({
      where: { code, status: 'pending', userId2: null },
      data: { userId2: uid, status: 'active' },
    });
    return res.count === 1;
  }

  async leavePair(userId: bigint, code: string): Promise<void> {
    const uid = userId;
    const pair = await this.prisma.pair.findUnique({ where: { code } });
    if (!pair) return;
    if (pair.userId1 === uid) {
      await this.prisma.pair.delete({ where: { code } });
    } else if (pair.userId2 === uid) {
      await this.prisma.pair.update({
        where: { code },
        data: { userId2: null, status: 'pending' },
      });
    }
  }
}
