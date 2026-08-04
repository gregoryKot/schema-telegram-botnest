import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../utils/crypto';
import { isPhraseMarkId, type PhraseMarkId } from './phrase-check.constants';

// Упражнение «Разобрать фразу»: пользователь записывает реплику внутреннего
// голоса, отмечает приметы самокритики и переписывает фразу в самокоррекцию.
// Свой файл, а не метод в exercises.service.ts — правило №10 («один сервис =
// один файл» не означает «один файл на 13 доменов»).
//
// Свободный текст (phrase/rewrite) шифруется, как в остальных упражнениях.
// marks — перечисление id примет: по правилу шифрования (CLAUDE.md) типы-
// перечисления остаются открытыми, и только поэтому /stats умеет показать,
// что люди в своих фразах замечают чаще.
@Injectable()
export class PhraseCheckService {
  constructor(private readonly prisma: PrismaService) {}

  async getPhraseChecks(userId: bigint) {
    const rows = await this.prisma.userPhraseCheck.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      phrase: decrypt(r.phrase) ?? r.phrase,
      // Чужие/протухшие id молча отбрасываем: список примет со временем может
      // меняться, а старая запись не должна ронять экран истории.
      marks: (Array.isArray(r.marks) ? (r.marks as unknown[]) : [])
        .filter((m): m is string => typeof m === 'string')
        .filter(isPhraseMarkId),
      rewrite: decrypt(r.rewrite),
    }));
  }

  async createPhraseCheck(
    userId: bigint,
    data: { phrase: string; marks: PhraseMarkId[]; rewrite?: string },
  ) {
    const marks = [...new Set(data.marks)];
    const row = await this.prisma.userPhraseCheck.create({
      data: {
        userId,
        phrase: encrypt(data.phrase) ?? data.phrase,
        marks,
        rewrite: encrypt(data.rewrite),
      },
    });
    return {
      id: row.id,
      createdAt: row.createdAt,
      phrase: data.phrase,
      marks,
      rewrite: data.rewrite ?? null,
    };
  }

  async deletePhraseCheck(userId: bigint, id: number) {
    return this.prisma.userPhraseCheck.deleteMany({ where: { id, userId } });
  }
}
