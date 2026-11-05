// endClientRelations (решение владельца 2026-11-05): терапевт убрал клиента
// или клиент отключился сам — связь не удаляется, а получает `ended` с датой
// и причиной, а открытые задания этого терапевта этому клиенту становятся
// личными целями. Фейковый tx исполняет where честно (in, null, равенство),
// а не по факту вызова: иначе тест зеленел бы при выброшенном условии.
import type { Prisma } from '@prisma/client';
import { endClientRelations } from './end-client-relations';
import { CLIENT_LEFT, THERAPIST_REMOVED } from './relation-end-reason';

type Row = Record<string, unknown>;

function matches(r: Row, where: Row): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (cond === null) return r[k] === null;
    if (cond && typeof cond === 'object' && 'in' in cond)
      return (cond.in as unknown[]).includes(r[k]);
    return r[k] === cond;
  });
}

function table(rows: Row[]) {
  return {
    findMany: ({ where }: { where: Row }) =>
      Promise.resolve(rows.filter((r) => matches(r, where))),
    updateMany: ({ where, data }: { where: Row; data: Row }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return Promise.resolve({ count: hit.length });
    },
  };
}

const [T, T2, C, OTHER] = [10n, 20n, 1n, 2n];

function world() {
  const rels: Row[] = [
    { id: 1, therapistId: T, clientId: C, status: 'active' },
    { id: 2, therapistId: T2, clientId: C, status: 'active' }, // наследие: второй терапевт
    { id: 3, therapistId: T, clientId: OTHER, status: 'active' },
    { id: 4, therapistId: T, clientId: C, status: 'ended', endReason: 'x' },
  ];
  const tasks: Row[] = [
    { id: 1, userId: C, assignedBy: T, done: null }, // открытое от T
    { id: 2, userId: C, assignedBy: T, done: true }, // выполненное — история
    { id: 3, userId: C, assignedBy: T, done: false }, // закрытое «не вышло»
    { id: 4, userId: C, assignedBy: T2, done: null }, // от другого терапевта
    { id: 5, userId: C, assignedBy: null, done: null }, // своё
    { id: 6, userId: OTHER, assignedBy: T, done: null }, // другой клиент T
  ];
  const tx = {
    therapyRelation: table(rels),
    userTask: table(tasks),
  } as unknown as Prisma.TransactionClient;
  const status = (id: number) => rels.find((r) => r.id === id);
  const assigner = (id: number) => tasks.find((t) => t.id === id)?.assignedBy;
  return { tx, status, assigner };
}

describe('endClientRelations', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-05T09:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('терапевт убрал клиента: связь ended с датой и причиной, строка на месте', async () => {
    const w = world();
    const n = await endClientRelations(
      w.tx,
      { therapistId: T, clientId: C },
      THERAPIST_REMOVED,
    );
    expect(n).toBe(1);
    expect(w.status(1)).toMatchObject({
      status: 'ended',
      endedAt: new Date('2026-11-05T09:00:00Z'),
      endReason: THERAPIST_REMOVED,
    });
    // Связь клиента со вторым терапевтом, связь T с другим клиентом и
    // прежняя ended-строка (её причина) не тронуты.
    expect(w.status(2)?.status).toBe('active');
    expect(w.status(3)?.status).toBe('active');
    expect(w.status(4)?.endReason).toBe('x');
  });

  it('открытое задание этого терапевта — личная цель; выполненное, закрытое, чужое и своё — как были', async () => {
    const w = world();
    await endClientRelations(
      w.tx,
      { therapistId: T, clientId: C },
      THERAPIST_REMOVED,
    );
    expect(w.assigner(1)).toBeNull();
    expect([2, 3, 4, 5, 6].map(w.assigner)).toEqual([T, T, T2, null, T]);
  });

  it('клиент отключился сам: все его живые связи ended с причиной client_left, задания обоих терапевтов — его цели', async () => {
    const w = world();
    expect(await endClientRelations(w.tx, { clientId: C }, CLIENT_LEFT)).toBe(
      2,
    );
    expect([1, 2].map((id) => w.status(id)?.endReason)).toEqual([
      CLIENT_LEFT,
      CLIENT_LEFT,
    ]);
    expect([1, 4].map(w.assigner)).toEqual([null, null]);
    expect(w.assigner(6)).toBe(T); // другой клиент T не задет
  });

  it('живой связи нет (повторный DELETE, чужой клиент) — ничего не меняется, задания не трогаются', async () => {
    const w = world();
    expect(
      await endClientRelations(
        w.tx,
        { therapistId: T2, clientId: OTHER },
        THERAPIST_REMOVED,
      ),
    ).toBe(0);
    await endClientRelations(
      w.tx,
      { therapistId: T, clientId: C },
      THERAPIST_REMOVED,
    );
    const again = await endClientRelations(
      w.tx,
      { therapistId: T, clientId: C },
      CLIENT_LEFT,
    );
    expect(again).toBe(0);
    expect(w.status(1)?.endReason).toBe(THERAPIST_REMOVED);
  });
});
