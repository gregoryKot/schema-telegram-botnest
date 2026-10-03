import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

// M2 (аудит 2026-10): приглашение живёт 7 суток от createdAt. Раньше pending-код
// жил вечно, а после выхода партнёра пара сбрасывалась в pending с ТЕМ ЖЕ кодом —
// ссылка из старых чатов оставалась рабочей навсегда.
export const PAIR_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const newPairCode = () => randomBytes(6).toString('hex').toUpperCase();

const isInviteFresh = (createdAt: Date) =>
  Date.now() - createdAt.getTime() <= PAIR_INVITE_TTL_MS;

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
    if (existing && isInviteFresh(existing.createdAt)) return existing.code;
    const code = newPairCode();
    if (existing) {
      // Просроченное приглашение — перевыпускаем код (старая ссылка умирает)
      // и обновляем срок на той же строке, не плодя pending-пары.
      await this.prisma.pair.update({
        where: { id: existing.id },
        data: { code, createdAt: new Date() },
      });
      return code;
    }
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
      pair.userId2 === uid ||
      !isInviteFresh(pair.createdAt)
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
        // Новый код и новый срок: ссылка, ушедшая в чаты до выхода партнёра,
        // не должна впускать в пару следующего человека.
        data: {
          userId2: null,
          status: 'pending',
          code: newPairCode(),
          createdAt: new Date(),
        },
      });
    }
  }
}
