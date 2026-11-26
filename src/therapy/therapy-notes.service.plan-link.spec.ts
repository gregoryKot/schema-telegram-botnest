// Итоги сессии ↔ пункты плана: чужие id и дубли отбрасываются, «planned» →
// «active» только у отмеченных своих пунктов, остальные статусы не трогаются.
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';

const T1 = 100n;
const CLIENT = 555n;
const rel: Rel = {
  id: 1,
  therapistId: T1,
  clientId: CLIENT,
  status: 'active',
  code: 'AAA111',
};

type Item = {
  id: number;
  therapistId: bigint;
  clientId: bigint;
  status: string;
};

function setup() {
  const items: Item[] = [
    { id: 1, therapistId: T1, clientId: CLIENT, status: 'planned' },
    { id: 2, therapistId: T1, clientId: CLIENT, status: 'planned' },
    { id: 3, therapistId: T1, clientId: CLIENT, status: 'done' },
    { id: 4, therapistId: T1, clientId: CLIENT, status: 'postponed' },
    { id: 5, therapistId: 200n, clientId: 999n, status: 'planned' }, // чужой
  ];
  const created: Record<string, unknown>[] = [];
  const matches = (r: Item, w: any) =>
    w.id.in.includes(r.id) &&
    r.therapistId === w.therapistId &&
    r.clientId === w.clientId &&
    (w.status === undefined || r.status === w.status);
  const prisma: any = {
    ...makeRelationPrismaMock([rel]),
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
    therapyPlanItem: {
      findMany: jest.fn(async ({ where }: any) =>
        items.filter((r) => matches(r, where)).map((r) => ({ id: r.id })),
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = items.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
    therapistNote: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: created.length + 1, createdAt: new Date(), ...data };
        created.push(row);
        return row;
      }),
    },
  };
  const service = new TherapyNotesService(
    prisma,
    new TherapyRelationsService(prisma, {} as any),
  );
  const status = (id: number) => items.find((r) => r.id === id)?.status;
  return { service, status };
}

describe('TherapyNotesService.createNote — planItemIds', () => {
  it('чужие и несуществующие id отбрасываются, дубли убираются', async () => {
    const { service } = setup();
    const note = await service.createNote(T1, CLIENT, {
      date: '2026-01-05',
      text: 'x',
      planItemIds: [2, 1, 2, 5, 777],
    });
    expect(note.planItemIds).toEqual([2, 1]);
  });

  it('planned → active только у отмеченных; done, postponed и чужой не трогаются', async () => {
    const { service, status } = setup();
    await service.createNote(T1, CLIENT, {
      date: '2026-01-05',
      text: 'x',
      planItemIds: [1, 3, 4, 5],
    });
    expect([1, 2, 3, 4, 5].map(status)).toEqual([
      'active',
      'planned',
      'done',
      'postponed',
      'planned',
    ]);
  });

  it('без planItemIds — пустой список и статусы на месте', async () => {
    const { service, status } = setup();
    const note = await service.createNote(T1, CLIENT, {
      date: '2026-01-05',
      text: 'x',
    });
    expect(note.planItemIds).toEqual([]);
    expect(status(1)).toBe('planned');
  });
});
