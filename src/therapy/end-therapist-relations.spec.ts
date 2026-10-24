// endTherapistRelations: что завершается при отказе терапевта от роли и с какой
// причиной (решение владельца 2026-10-22). Строки не удаляются, а получают
// status=ended + endedAt + endReason — по ним клиент видит сообщение о бывшем
// терапевте. Офлайн-клиенты не завершаются (Step D слияния стёр бы их
// концептуализации) — фейковый tx исполняет where честно, а не по вызову.
import type { Prisma } from '@prisma/client';
import { endTherapistRelations } from './end-therapist-relations';
import { THERAPIST_RESIGNED } from './relation-end-reason';

type Row = {
  id: number;
  therapistId: bigint;
  clientId: bigint | null;
  virtualClientName: string | null;
  status: string;
  endedAt?: Date | null;
  endReason?: string | null;
};
type Where = Record<string, unknown>;

function matches(r: Row, where: Where): boolean {
  return Object.entries(where).every(([k, cond]) => {
    const v = r[k as keyof Row];
    if (cond === null) return v === null;
    if (cond && typeof cond === 'object') {
      const c = cond as { in?: unknown[]; not?: unknown };
      if (c.in) return c.in.includes(v);
      if ('not' in c) return v !== c.not;
    }
    return v === cond;
  });
}

function makeTx(rows: Row[]) {
  const updateMany = jest.fn(
    ({ where, data }: { where: Where; data: object }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return Promise.resolve({ count: hit.length });
    },
  );
  return {
    tx: {
      therapyRelation: { updateMany },
    } as unknown as Prisma.TransactionClient,
    updateMany,
  };
}

const T = 10n;
const rel = (
  id: number,
  clientId: bigint | null,
  status: string,
  virtualClientName: string | null = null,
  therapistId = T,
): Row => ({ id, therapistId, clientId, virtualClientName, status });
const fixture = (): Row[] => [
  rel(1, 1n, 'active'),
  rel(2, 2n, 'active'),
  rel(3, null, 'pending'), // приглашение
  rel(4, null, 'active', 'Офлайн'), // офлайн-клиент
  rel(5, 3n, 'ended'),
  rel(6, 1n, 'active', null, 99n), // другой терапевт
];

describe('endTherapistRelations', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T09:00:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  it('клиенты и приглашение: ended + дата + причина therapist_resigned', async () => {
    const rows = fixture();
    await endTherapistRelations(makeTx(rows).tx, T);
    for (const id of [1, 2, 3]) {
      expect(rows[id - 1]).toMatchObject({
        status: 'ended',
        endedAt: new Date('2026-10-22T09:00:00Z'),
        endReason: THERAPIST_RESIGNED,
      });
    }
  });

  it('офлайн-клиент остаётся active без даты и причины', async () => {
    const rows = fixture();
    await endTherapistRelations(makeTx(rows).tx, T);
    expect(rows[3]).toMatchObject({ status: 'active' });
    expect(rows[3].endedAt).toBeUndefined();
    expect(rows[3].endReason).toBeUndefined();
  });

  it('уже завершённая связь и связи другого терапевта не трогаются', async () => {
    const rows = fixture();
    await endTherapistRelations(makeTx(rows).tx, T);
    expect(rows[4].endReason).toBeUndefined();
    expect(rows[5]).toMatchObject({ status: 'active' });
    expect(rows[5].endReason).toBeUndefined();
  });

  it('возвращает число завершённых связей с настоящими клиентами — приглашение не в счёт', async () => {
    expect(await endTherapistRelations(makeTx(fixture()).tx, T)).toBe(2);
  });

  it('у терапевта без клиентов — 0', async () => {
    expect(await endTherapistRelations(makeTx([]).tx, T)).toBe(0);
  });
});
