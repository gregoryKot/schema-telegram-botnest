// Общий фейковый Prisma-мок therapyRelation для therapy-relations.service.spec.ts
// и therapy-notes.service.spec.ts — не дублируем один и тот же мок в двух
// файлах (CLAUDE.md, п.3: общий хелпер — в отдельный файл).

export interface Rel {
  id: number;
  therapistId: bigint;
  clientId: bigint | null;
  status: string;
  code: string;
  createdAt?: Date;
}

// where-условие поля: значение, null или оператор Prisma (`not`, `gte`).
// Нужен реальный разбор операторов: мок, игнорирующий `{ not }` и `clientId:
// null`, пропускал бы ровно те условия, на которых держатся T3/T4 (аудит
// 2026-10) — тест зеленел бы при выброшенной проверке.
function fieldMatches(actual: unknown, cond: unknown): boolean {
  if (cond === undefined) return true;
  if (
    cond !== null &&
    typeof cond === 'object' &&
    !(cond instanceof Date) &&
    typeof cond !== 'bigint'
  ) {
    const c = cond as { not?: unknown; gte?: Date };
    if ('not' in c) return actual !== c.not;
    if ('gte' in c) return (actual as Date) >= (c.gte as Date);
  }
  return actual === cond;
}

function relMatches(r: Rel, where: any = {}): boolean {
  if (where.OR) return (where.OR as any[]).some((c) => relMatches(r, c));
  return (
    fieldMatches(r.id, where.id) &&
    fieldMatches(r.therapistId, where.therapistId) &&
    fieldMatches(r.clientId, where.clientId) &&
    fieldMatches(r.status, where.status) &&
    fieldMatches(r.code, where.code) &&
    fieldMatches(r.createdAt ?? new Date(), where.createdAt)
  );
}

// Обычные async-функции, а не jest.fn() — этот файл не *.spec.ts, поэтому
// не подключается к tsconfig.build.json/@types/jest; спай на вызовы этим
// тестам не нужен (см. отсутствие toHaveBeenCalled в обоих спеках).
export function makeRelationPrismaMock(rels: Rel[]) {
  let nextId = rels.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  return {
    therapyRelation: {
      findFirst: async ({ where }: any) =>
        rels.find((r) => relMatches(r, where)) ?? null,
      // createdAt по умолчанию «сейчас» — как @default(now()) в схеме.
      findUnique: async ({ where }: any) => {
        const r = rels.find((x) => x.code === where.code);
        return r ? { createdAt: new Date(), ...r } : null;
      },
      create: async ({ data }: any) => {
        const rel: Rel = {
          clientId: null,
          status: 'pending',
          createdAt: new Date(),
          ...data,
          id: nextId++,
        };
        rels.push(rel);
        return rel;
      },
      update: async ({ where, data }: any) => {
        const r = rels.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      },
      updateMany: async ({ where, data }: any) => {
        const hit = rels.filter((r) => relMatches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: any) => {
        const before = rels.length;
        for (let i = rels.length - 1; i >= 0; i--)
          if (relMatches(rels[i], where)) rels.splice(i, 1);
        return { count: before - rels.length };
      },
    },
  };
}
