// Тумблер «Показать клиенту» и схема случая клиента (concept-share.ts):
// «включил → клиент нашёл», «выключил → не нашёл», чужая пара не видна,
// повторное включение дату не сдвигает, офлайн-клиенту показывать некому.
import { BadRequestException } from '@nestjs/common';
import { findSharedConcept, setConceptShared } from './concept-share';

const T1 = 100n;
const T2 = 200n;
const C1 = 555n;

type Row = Record<string, unknown> & { therapistId: bigint; clientId: bigint };
type Key = { therapistId: bigint; clientId: bigint };

function makePrisma(rows: Row[], therapists: bigint[] = [T1]) {
  const byKey = (k: Key) =>
    rows.find(
      (r) => r.therapistId === k.therapistId && r.clientId === k.clientId,
    );
  return {
    rows,
    therapyRelation: {
      // Связь клиента: активная, терапевт с ролью THERAPIST.
      findMany: jest.fn(async ({ where }: { where: { clientId: bigint } }) =>
        therapists.map((id) => ({
          clientId: where.clientId,
          therapist: { id, firstName: null, role: 'THERAPIST' },
        })),
      ),
    },
    clientConceptualization: {
      findUnique: jest.fn(
        async ({ where }: { where: { therapistId_clientId: Key } }) =>
          byKey(where.therapistId_clientId) ?? null,
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: Key; data: object }) => {
          const r = byKey(where);
          if (r) Object.assign(r, data);
          return { count: r ? 1 : 0 };
        },
      ),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { therapistId_clientId: Key };
          create: Row;
          update: object;
        }) => {
          const r = byKey(where.therapistId_clientId);
          if (r) return Object.assign(r, update);
          rows.push({ ...create, updatedAt: new Date() });
          return create;
        },
      ),
    },
  };
}

const allow = { assertHasClient: jest.fn(async () => undefined) };
const deny = {
  assertHasClient: jest.fn(async () => {
    throw new Error('No active relation');
  }),
};
const deps = (prisma: ReturnType<typeof makePrisma>, relations = allow) => ({
  prisma: prisma as never,
  relations,
});

const concept = (over: Partial<Row> = {}): Row => ({
  therapistId: T1,
  clientId: C1,
  schemaIds: ['defectiveness'],
  modeIds: [],
  modeLinks: [],
  schemaLinks: [],
  goals: 'задача терапии',
  history: [],
  sharedWithClientAt: null,
  updatedAt: new Date(),
  ...over,
});

describe('setConceptShared + findSharedConcept', () => {
  it('включил → клиент нашёл схему; выключил → не нашёл', async () => {
    const prisma = makePrisma([concept()]);
    await expect(findSharedConcept(prisma as never, C1)).resolves.toBeNull();

    const on = await setConceptShared(
      deps(prisma),
      { therapistId: T1, clientId: C1 },
      true,
    );
    expect(on.sharedWithClientAt).toBeInstanceOf(Date);
    const view = await findSharedConcept(prisma as never, C1);
    expect(view).toMatchObject({
      schemaIds: ['defectiveness'],
      sharedWithClientAt: on.sharedWithClientAt,
    });
    expect(view).not.toHaveProperty('goals');

    await expect(
      setConceptShared(deps(prisma), { therapistId: T1, clientId: C1 }, false),
    ).resolves.toEqual({ sharedWithClientAt: null });
    await expect(findSharedConcept(prisma as never, C1)).resolves.toBeNull();
  });

  it('повторное включение не сдвигает дату показа', async () => {
    const first = new Date('2026-11-01T08:00:00Z');
    const prisma = makePrisma([concept({ sharedWithClientAt: first })]);
    const again = await setConceptShared(
      deps(prisma),
      { therapistId: T1, clientId: C1 },
      true,
    );
    expect(again.sharedWithClientAt).toEqual(first);
  });

  it('строки ещё нет: включение создаёт её, выключение ничего не создаёт', async () => {
    const prisma = makePrisma([]);
    await setConceptShared(
      deps(prisma),
      { therapistId: T1, clientId: C1 },
      false,
    );
    expect(prisma.rows).toHaveLength(0);
    await setConceptShared(
      deps(prisma),
      { therapistId: T1, clientId: C1 },
      true,
    );
    expect(prisma.rows).toHaveLength(1);
    await expect(findSharedConcept(prisma as never, C1)).resolves.toMatchObject(
      { schemaIds: [], modeLinks: [] },
    );
  });

  it('чужой терапевт не включит: проверка связи до записи', async () => {
    const prisma = makePrisma([concept()]);
    await expect(
      setConceptShared(
        deps(prisma, deny),
        { therapistId: T2, clientId: C1 },
        true,
      ),
    ).rejects.toThrow('No active relation');
    expect(prisma.clientConceptualization.upsert).not.toHaveBeenCalled();
  });

  it('офлайн-клиент (отрицательный id) — 400: показывать некому', async () => {
    const prisma = makePrisma([]);
    await expect(
      setConceptShared(deps(prisma), { therapistId: T1, clientId: -7n }, true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rows).toHaveLength(0);
  });

  it('клиент видит схему только терапевта из «Мой терапевт», не чужой пары', async () => {
    const prisma = makePrisma(
      [concept({ therapistId: T2, sharedWithClientAt: new Date() })],
      [T1],
    );
    await expect(findSharedConcept(prisma as never, C1)).resolves.toBeNull();
    expect(prisma.clientConceptualization.findUnique).toHaveBeenCalledWith({
      where: { therapistId_clientId: { therapistId: T1, clientId: C1 } },
    });
  });

  it('нет связи с терапевтом — null без запроса концептуализации', async () => {
    const prisma = makePrisma(
      [concept({ sharedWithClientAt: new Date() })],
      [],
    );
    await expect(findSharedConcept(prisma as never, C1)).resolves.toBeNull();
    expect(prisma.clientConceptualization.findUnique).not.toHaveBeenCalled();
  });
});
