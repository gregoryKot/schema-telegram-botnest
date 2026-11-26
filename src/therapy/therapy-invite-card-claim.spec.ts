// Сверка «Это тот же человек?» для кода из офлайн-карточки (аудит 2026-11,
// S8; решение владельца Р3). До неё join сразу переносил на аккаунт задания и
// карты режимов карточки — кто бы ни ввёл код. Живой проход —
// test/therapy-card-claim.e2e-spec.ts.
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import { attachOfflineCard } from './therapy-invite-attach';
import { encryptName } from './client-name';
import {
  listCardClaims,
  resolveCardClaim,
  trackCardClaim,
} from './therapy-invite-card-claim';

jest.mock('./therapy-invite-attach', () => ({
  attachOfflineCard: jest.fn().mockResolvedValue(true),
}));
const attachMock = attachOfflineCard as jest.Mock;
beforeEach(() => attachMock.mockClear().mockResolvedValue(true));

const TH = 1n;
const OTHER_TH = 2n;
const B = 500n;

type Row = Record<string, unknown>;
const matches = (row: Row, where: Row) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'not' in v) return row[k] != null;
    if (v && typeof v === 'object' && 'in' in v)
      return (v.in as unknown[]).includes(row[k]);
    return row[k] === v;
  });

// Минимальная таблица связей: where по полям, без джойнов.
function makeDb(rows: Row[]) {
  const rel = {
    findFirst: jest.fn(
      async ({ where }: { where: Row }) =>
        rows.find((r) => matches(r, where)) ?? null,
    ),
    findMany: jest.fn(async ({ where }: { where: Row }) =>
      rows.filter((r) => matches(r, where)),
    ),
    updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
  };
  return { prisma: { therapyRelation: rel } as unknown as PrismaService, rel };
}

const card = (o: Row = {}) => ({
  id: 9,
  therapistId: TH,
  clientId: null,
  status: 'active',
  virtualClientName: encryptName('Мария К.'),
  ...o,
});
const claimed = (o: Row = {}) => ({
  id: 20,
  therapistId: TH,
  clientId: B,
  status: 'active',
  attachToId: 9,
  clientAlias: null,
  client: { firstName: 'masha_b' },
  ...o,
});

describe('listCardClaims', () => {
  it('связь с отметкой → плашка: имя карточки и аккаунта', async () => {
    const { prisma } = makeDb([card(), claimed()]);
    expect(await listCardClaims(prisma, TH)).toEqual([
      { clientId: B, clientName: 'masha_b', cardId: 9, cardName: 'Мария К.' },
    ]);
  });

  it('у уже подключённого — имя, которым его назвал терапевт', async () => {
    const { prisma } = makeDb([
      card(),
      claimed({ clientAlias: encryptName('Борис') }),
    ]);
    const [c] = await listCardClaims(prisma, TH);
    expect(c.clientName).toBe('Борис');
  });

  it('нет отметок → [] без второго запроса; карточки нет → строка не выводится', async () => {
    const empty = makeDb([card(), claimed({ attachToId: null })]);
    expect(await listCardClaims(empty.prisma, TH)).toEqual([]);
    expect(empty.rel.findMany).toHaveBeenCalledTimes(1);
    const orphan = makeDb([claimed()]);
    expect(await listCardClaims(orphan.prisma, TH)).toEqual([]);
  });

  it('чужой терапевт сверок этого не видит', async () => {
    const { prisma } = makeDb([card(), claimed()]);
    expect(await listCardClaims(prisma, OTHER_TH)).toEqual([]);
  });
});

describe('resolveCardClaim', () => {
  it('«Да» → attachOfflineCard (данные карточки переезжают)', async () => {
    const { prisma } = makeDb([card(), claimed()]);
    expect(await resolveCardClaim(prisma, TH, B, 9, true)).toBe(true);
    expect(attachMock).toHaveBeenCalledWith(prisma, TH, B, 9);
  });

  it('«Нет» → отметка снята, перенос не зовётся, карточка на месте', async () => {
    const rows = [card(), claimed()];
    const { prisma } = makeDb(rows);
    expect(await resolveCardClaim(prisma, TH, B, 9, false)).toBe(true);
    expect(attachMock).not.toHaveBeenCalled();
    expect(rows[1].attachToId).toBeNull();
    expect(rows[0]).toMatchObject({ id: 9, clientId: null });
    // Повторный ответ — сверки уже нет.
    expect(await resolveCardClaim(prisma, TH, B, 9, true)).toBe(false);
  });

  it('чужой терапевт не подтверждает и не отклоняет — false, ничего не тронуто', async () => {
    const rows = [card(), claimed()];
    const { prisma, rel } = makeDb(rows);
    expect(await resolveCardClaim(prisma, OTHER_TH, B, 9, true)).toBe(false);
    expect(await resolveCardClaim(prisma, OTHER_TH, B, 9, false)).toBe(false);
    expect(attachMock).not.toHaveBeenCalled();
    expect(rel.updateMany).not.toHaveBeenCalled();
    expect(rows[1].attachToId).toBe(9);
  });

  it('другая карточка или офлайн-id клиента → false', async () => {
    const { prisma } = makeDb([card(), claimed()]);
    expect(await resolveCardClaim(prisma, TH, B, 10, true)).toBe(false);
    expect(await resolveCardClaim(prisma, TH, -9n, 9, true)).toBe(false);
    expect(attachMock).not.toHaveBeenCalled();
  });

  it('«Да», а карточки уже нет → отметка снята, false', async () => {
    attachMock.mockResolvedValue(false);
    const rows = [claimed()];
    const { prisma } = makeDb(rows);
    expect(await resolveCardClaim(prisma, TH, B, 9, true)).toBe(false);
    expect(rows[0].attachToId).toBeNull();
  });
});

describe('trackCardClaim', () => {
  it.each([
    [true, 'confirmed'],
    [false, 'denied'],
  ])('ответ %s → therapy_invite/%s/offline от терапевта', async (a, step) => {
    const track = jest.fn().mockResolvedValue(undefined);
    await trackCardClaim({ track } as unknown as AnalyticsService, TH, a);
    expect(track).toHaveBeenCalledWith(TH, 'therapy_invite', {
      step,
      kind: 'offline',
    });
  });
});
