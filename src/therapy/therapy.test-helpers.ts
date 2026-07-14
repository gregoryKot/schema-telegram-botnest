// Общий фейковый Prisma-мок therapyRelation для therapy-relations.service.spec.ts
// и therapy-notes.service.spec.ts — не дублируем один и тот же мок в двух
// файлах (CLAUDE.md, п.3: общий хелпер — в отдельный файл).

export interface Rel {
  id: number;
  therapistId: bigint;
  clientId: bigint | null;
  status: string;
  code: string;
}

// Обычные async-функции, а не jest.fn() — этот файл не *.spec.ts, поэтому
// не подключается к tsconfig.build.json/@types/jest; спай на вызовы этим
// тестам не нужен (см. отсутствие toHaveBeenCalled в обоих спеках).
export function makeRelationPrismaMock(rels: Rel[]) {
  return {
    therapyRelation: {
      findFirst: async ({ where }: any) =>
        rels.find(
          (r) =>
            (where.id === undefined || r.id === where.id) &&
            (where.therapistId === undefined ||
              r.therapistId === where.therapistId) &&
            (where.clientId === undefined || r.clientId === where.clientId) &&
            (where.status === undefined || r.status === where.status),
        ) ?? null,
      findUnique: async ({ where }: any) =>
        rels.find((r) => r.code === where.code) ?? null,
      update: async ({ where, data }: any) => {
        const r = rels.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      },
    },
  };
}
