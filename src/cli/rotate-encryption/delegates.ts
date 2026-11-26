// Доступ к делегатам Prisma по имени из списка TARGETS — общий для ротации
// (rotate-all.ts) и пробы самопроверки encryptionReadable: обход одного и того
// же списка колонок не копируется, а берётся отсюда (jscpd, правило №11).
import type { PrismaClient } from '@prisma/client';
import { RotationTarget } from './targets';

type Row = Record<string, unknown>;
// Минимальный структурный вид делегата Prisma: модели обходятся по имени из
// списка, конкретные сгенерированные типы тут недоступны.
export interface Delegate {
  findMany(args: {
    select: Record<string, true>;
    take?: number;
    orderBy?: Record<string, 'desc'>[];
  }): Promise<Row[]>;
  updateMany(args: { where: Row; data: Row }): Promise<{ count: number }>;
}

export const pkColumns = (t: RotationTarget): string[] =>
  t.pk === undefined ? ['id'] : [t.pk].flat();

export function delegateOf(prisma: PrismaClient, name: string): Delegate {
  const d = (prisma as unknown as Record<string, Delegate | undefined>)[name];
  if (!d?.findMany || !d.updateMany)
    throw new Error(`в клиенте Prisma нет модели ${name}`);
  return d;
}
