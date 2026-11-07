// Удаление задания терапевтом и отметка задания офлайн-клиента (QA
// 2026-10-26: удалить задание было нельзя ни в интерфейсе, ни в API, а
// задание офлайн-клиента закрыть было некому). Граница доступа: задание
// назначено ЭТИМ терапевтом И связь с владельцем активна.
import type { PrismaService } from '../prisma/prisma.service';
import { completeOfflineTask, deleteAssignedTask } from './assigned-task';

interface Task {
  id: number;
  userId: bigint;
  assignedBy: bigint | null;
  done: boolean | null;
}
interface Rel {
  id: number;
  therapistId: bigint;
  clientId: bigint | null;
  status: string;
}

type Cond = bigint | number | string | null | { lt: bigint };
const matches = (row: object, where: Record<string, Cond>) =>
  Object.entries(where).every(([k, c]) => {
    const v = (row as Record<string, unknown>)[k];
    if (c !== null && typeof c === 'object') return (v as bigint) < c.lt;
    return v === c;
  });

const T = 10n;
const OTHER_T = 11n;
const CLIENT = 500n;
const FORMER = 501n;

function setup() {
  const tasks: Task[] = [
    { id: 1, userId: CLIENT, assignedBy: T, done: null }, // своему клиенту
    { id: 2, userId: CLIENT, assignedBy: null, done: null }, // своя цель клиента
    { id: 3, userId: CLIENT, assignedBy: OTHER_T, done: null }, // чужого терапевта
    { id: 4, userId: -7n, assignedBy: T, done: null }, // офлайн-клиенту
    { id: 5, userId: FORMER, assignedBy: T, done: null }, // бывшему клиенту
    { id: 6, userId: -8n, assignedBy: T, done: null }, // офлайн, связь снята
  ];
  const rels: Rel[] = [
    { id: 1, therapistId: T, clientId: CLIENT, status: 'active' },
    { id: 7, therapistId: T, clientId: null, status: 'active' },
    { id: 2, therapistId: T, clientId: FORMER, status: 'ended' },
    { id: 8, therapistId: T, clientId: null, status: 'ended' },
  ];
  const prisma = {
    userTask: {
      findFirst: ({ where }: { where: Record<string, Cond> }) =>
        Promise.resolve(tasks.find((t) => matches(t, where)) ?? null),
      deleteMany: ({ where }: { where: Record<string, Cond> }) => {
        const keep = tasks.filter((t) => !matches(t, where));
        const count = tasks.length - keep.length;
        tasks.splice(0, tasks.length, ...keep);
        return Promise.resolve({ count });
      },
      updateMany: ({
        where,
        data,
      }: {
        where: Record<string, Cond>;
        data: { done: boolean };
      }) => {
        const hit = tasks.filter((t) => matches(t, where));
        hit.forEach((t) => (t.done = data.done));
        return Promise.resolve({ count: hit.length });
      },
    },
    therapyRelation: {
      findFirst: ({ where }: { where: Record<string, Cond> }) =>
        Promise.resolve(rels.find((r) => matches(r, where)) ?? null),
    },
  } as unknown as PrismaService;
  const ids = () => tasks.map((t) => t.id);
  const doneOf = (id: number) => tasks.find((t) => t.id === id)?.done;
  return { prisma, ids, doneOf };
}

describe('deleteAssignedTask', () => {
  it('своё задание текущему клиенту и офлайн-клиенту удаляется и пропадает', async () => {
    const { prisma, ids } = setup();
    await expect(deleteAssignedTask(prisma, T, 1)).resolves.toBe(true);
    await expect(deleteAssignedTask(prisma, T, 4)).resolves.toBe(true);
    expect(ids()).toEqual([2, 3, 5, 6]);
  });

  it('свою цель клиента, задание чужого терапевта и несуществующее — нельзя', async () => {
    const { prisma, ids } = setup();
    for (const id of [2, 3, 999])
      await expect(deleteAssignedTask(prisma, T, id)).resolves.toBe(false);
    await expect(deleteAssignedTask(prisma, OTHER_T, 1)).resolves.toBe(false);
    expect(ids()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('после разрыва связи задания остаются у клиента', async () => {
    const { prisma, ids } = setup();
    await expect(deleteAssignedTask(prisma, T, 5)).resolves.toBe(false);
    await expect(deleteAssignedTask(prisma, T, 6)).resolves.toBe(false);
    expect(ids()).toContain(5);
  });
});

describe('completeOfflineTask', () => {
  it('задание офлайн-клиента терапевт закрывает сам', async () => {
    const { prisma, doneOf } = setup();
    await expect(completeOfflineTask(prisma, T, 4, true)).resolves.toBe(true);
    expect(doneOf(4)).toBe(true);
  });

  it('задание клиента с аккаунтом терапевт за клиента не закрывает', async () => {
    const { prisma, doneOf } = setup();
    await expect(completeOfflineTask(prisma, T, 1, true)).resolves.toBe(false);
    expect(doneOf(1)).toBeNull();
  });

  it('чужой терапевт и снятая связь — нельзя', async () => {
    const { prisma, doneOf } = setup();
    await expect(completeOfflineTask(prisma, OTHER_T, 4, true)).resolves.toBe(
      false,
    );
    await expect(completeOfflineTask(prisma, T, 6, true)).resolves.toBe(false);
    expect(doneOf(4)).toBeNull();
    expect(doneOf(6)).toBeNull();
  });
});
