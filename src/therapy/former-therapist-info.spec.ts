// getFormerTherapistInfo: строка о бывшем терапевте вместо «Мой терапевт» —
// терапевт отказался от роли (решение владельца 2026-10-22), убрал клиента
// или клиент отключился сам (2026-11-05). Фейк исполняет where сам —
// проверяется не форма вызова, а какие строки находятся.
import type { PrismaService } from '../prisma/prisma.service';
import { byLatestEnd, getFormerTherapistInfo } from './former-therapist-info';
import {
  CLIENT_LEFT,
  THERAPIST_REMOVED,
  THERAPIST_RESIGNED,
} from './relation-end-reason';

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
// Текущая роль терапевтов; по умолчанию — CLIENT (отказались и не вернулись).
let roles: Record<string, string> = {};
const roleOf = (id: bigint) => roles[String(id)] ?? 'CLIENT';

type Cond = { in?: unknown[]; not?: unknown };

function matches(r: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, cond]) => {
    const v = r[k as keyof Row];
    if (cond && typeof cond === 'object' && 'in' in cond)
      return (cond as Cond).in!.includes(v);
    return v === cond;
  });
}

beforeEach(() => {
  roles = {};
});

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
            therapist: {
              firstName: names[String(r.therapistId)],
              role: roleOf(r.therapistId),
            },
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
  it('терапевт отказался от роли → имя, дата окончания и причина', async () => {
    const res = await getFormerTherapistInfo(makePrisma([row({})]), C);
    expect(res).toEqual({
      name: 'Анна',
      endedAt: '2026-10-20T10:00:00.000Z',
      reason: THERAPIST_RESIGNED,
    });
  });

  // 2026-11-05: связь больше не удаляется — каждая причина даёт свою строку.
  it.each([THERAPIST_REMOVED, CLIENT_LEFT])(
    'причина %s → строка с этой причиной, роль терапевта не важна',
    async (reason) => {
      roles = { '1': 'THERAPIST' }; // терапевт работает дальше
      const res = await getFormerTherapistInfo(
        makePrisma([row({ endReason: reason })]),
        C,
      );
      expect(res).toEqual({
        name: 'Анна',
        endedAt: '2026-10-20T10:00:00.000Z',
        reason,
      });
    },
  );

  it('неизвестная причина → null (строки без текста не бывает)', async () => {
    const rows = [row({ endReason: 'something_else' })];
    expect(await getFormerTherapistInfo(makePrisma(rows), C)).toBeNull();
  });

  it('убрал один терапевт, позже отключился сам от другого — последняя причина', async () => {
    roles = { '1': 'THERAPIST', '2': 'THERAPIST' };
    const rows = [
      row({
        therapistId: 1n,
        endReason: THERAPIST_REMOVED,
        endedAt: new Date('2026-10-01T00:00:00Z'),
      }),
      row({
        therapistId: 2n,
        endReason: CLIENT_LEFT,
        endedAt: new Date('2026-11-01T00:00:00Z'),
      }),
    ];
    const res = await getFormerTherapistInfo(makePrisma(rows), C);
    expect([res?.name, res?.reason]).toEqual(['Борис', CLIENT_LEFT]);
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
      reason: THERAPIST_RESIGNED,
    });
  });

  it('терапевт снова получил роль, клиент не переподключился → null', async () => {
    roles = { '1': 'THERAPIST' };
    expect(await getFormerTherapistInfo(makePrisma([row({})]), C)).toBeNull();
  });

  it('последний — вернувшийся терапевт, ранний — нет: показывается ранний', async () => {
    roles = { '2': 'THERAPIST' };
    const rows = [
      row({ therapistId: 1n, endedAt: new Date('2026-10-01T00:00:00Z') }),
      row({ therapistId: 2n, endedAt: new Date('2026-10-21T00:00:00Z') }),
    ];
    const prisma = makePrisma(rows);
    expect((await getFormerTherapistInfo(prisma, C))?.name).toBe('Анна');
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
