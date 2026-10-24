// getFormerTherapistInfo: сообщение «терапевт больше не работает в приложении»
// (решение владельца 2026-10-22). Фейк исполняет where сам — проверяется не
// форма вызова, а какие строки находятся.
import type { PrismaService } from '../prisma/prisma.service';
import { byLatestEnd, getFormerTherapistInfo } from './former-therapist-info';
import { THERAPIST_RESIGNED } from './relation-end-reason';

type Row = {
  therapistId: bigint;
  clientId: bigint | null;
  status: string;
  endReason: string | null;
  endedAt: Date | null;
  createdAt: Date;
};

const C = 5n;
const names: Record<string, string | null> = {
  '1': 'Анна',
  '2': 'Борис',
  '3': null,
};

function matches(r: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, cond]) => {
    const v = r[k as keyof Row];
    if (cond && typeof cond === 'object' && 'in' in cond)
      return (cond as { in: unknown[] }).in.includes(v);
    return v === cond;
  });
}

function makePrisma(rows: Row[]) {
  const therapyRelation = {
    count: jest.fn(({ where }) =>
      Promise.resolve(rows.filter((r) => matches(r, where)).length),
    ),
    findMany: jest.fn(({ where }) =>
      Promise.resolve(
        rows
          .filter((r) => matches(r, where))
          .map((r) => ({
            ...r,
            therapist: { firstName: names[String(r.therapistId)] },
          })),
      ),
    ),
  };
  return { therapyRelation } as unknown as PrismaService;
}

const row = (o: Partial<Row>): Row => ({
  therapistId: 1n,
  clientId: C,
  status: 'ended',
  endReason: THERAPIST_RESIGNED,
  endedAt: new Date('2026-10-20T10:00:00Z'),
  createdAt: new Date('2026-09-01T10:00:00Z'),
  ...o,
});

describe('getFormerTherapistInfo', () => {
  it('терапевт отказался от роли → имя и дата окончания', async () => {
    const res = await getFormerTherapistInfo(makePrisma([row({})]), C);
    expect(res).toEqual({ name: 'Анна', endedAt: '2026-10-20T10:00:00.000Z' });
  });

  it('у клиента активная связь с новым терапевтом → null', async () => {
    const rows = [row({}), row({ therapistId: 2n, status: 'active' })];
    expect(await getFormerTherapistInfo(makePrisma(rows), C)).toBeNull();
  });

  it('pending-связь тоже значит «подключён» → null', async () => {
    const rows = [row({}), row({ therapistId: 2n, status: 'pending' })];
    expect(await getFormerTherapistInfo(makePrisma(rows), C)).toBeNull();
  });

  it('завершённых связей нет → null', async () => {
    expect(await getFormerTherapistInfo(makePrisma([]), C)).toBeNull();
  });

  it('ended без причины (дубль пары, не отказ от роли) → null', async () => {
    const rows = [row({ endReason: null })];
    expect(await getFormerTherapistInfo(makePrisma(rows), C)).toBeNull();
  });

  it('чужая завершённая связь не видна', async () => {
    const rows = [row({ clientId: 77n })];
    expect(await getFormerTherapistInfo(makePrisma(rows), C)).toBeNull();
  });

  it('из нескольких — последняя по дате окончания', async () => {
    const rows = [
      row({ therapistId: 1n, endedAt: new Date('2026-10-01T00:00:00Z') }),
      row({ therapistId: 2n, endedAt: new Date('2026-10-21T00:00:00Z') }),
    ];
    const res = await getFormerTherapistInfo(makePrisma(rows), C);
    expect(res?.name).toBe('Борис');
  });

  it('у старой связи даты нет: связь с датой важнее, endedAt = null у старой', async () => {
    const old = row({ therapistId: 2n, endedAt: null });
    const fresh = row({ therapistId: 1n });
    expect(
      (await getFormerTherapistInfo(makePrisma([old, fresh]), C))?.name,
    ).toBe('Анна');
    expect(await getFormerTherapistInfo(makePrisma([old]), C)).toEqual({
      name: 'Борис',
      endedAt: null,
    });
  });

  it('имени у терапевта нет → пустая строка, фронт пишет «Терапевт»', async () => {
    const res = await getFormerTherapistInfo(
      makePrisma([row({ therapistId: 3n })]),
      C,
    );
    expect(res?.name).toBe('');
  });
});

describe('byLatestEnd', () => {
  const d = (s: string) => new Date(s);
  it('без дат окончания решает createdAt по убыванию', () => {
    const a = { endedAt: null, createdAt: d('2026-01-01T00:00:00Z') };
    const b = { endedAt: null, createdAt: d('2026-05-01T00:00:00Z') };
    expect([a, b].sort(byLatestEnd)[0]).toBe(b);
  });
  it('пустая дата уходит в конец с любой стороны', () => {
    const dated = { endedAt: d('2026-01-01T00:00:00Z') };
    const empty = { endedAt: null };
    expect([empty, dated].sort(byLatestEnd)[0]).toBe(dated);
    expect([dated, empty].sort(byLatestEnd)[0]).toBe(dated);
  });
});
