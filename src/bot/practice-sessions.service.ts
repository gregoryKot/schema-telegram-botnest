import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Быстрые практики «Здесь и сейчас»: дыхание, заземление 5-4-3-2-1, техника
// «Стоп». Раньше не оставляли следа — пользователь не видел, что и сколько
// раз прошёл. Тут только факт прохождения (id/userId/tool/createdAt), без
// свободного текста — шифровать нечего (см. src/utils/encryption-coverage.spec.ts).
export const QUICK_PRACTICE_IDS = ['breathing', 'grounding', 'stop'] as const;
export type QuickPracticeId = (typeof QUICK_PRACTICE_IDS)[number];

@Injectable()
export class PracticeSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Read-after-write: клиент сразу показывает «прошли N раз» из ответа
  // записи, не дожидаясь отдельного запроса counts().
  async record(
    userId: bigint,
    tool: QuickPracticeId,
  ): Promise<{ count: number }> {
    await this.prisma.practiceSession.create({ data: { userId, tool } });
    const count = await this.prisma.practiceSession.count({
      where: { userId, tool },
    });
    return { count };
  }

  // Все три практики честно — отсутствующие в БД считаются нулём, а не
  // undefined/NaN (пустой аккаунт тоже должен показать 0/0/0).
  async counts(userId: bigint): Promise<Record<QuickPracticeId, number>> {
    const rows = await this.prisma.practiceSession.groupBy({
      by: ['tool'],
      where: { userId },
      _count: { _all: true },
    });
    const byTool = new Map(rows.map((r) => [r.tool, r._count._all]));
    return Object.fromEntries(
      QUICK_PRACTICE_IDS.map((id) => [id, byTool.get(id) ?? 0]),
    ) as Record<QuickPracticeId, number>;
  }
}
