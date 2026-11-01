// Список живых приглашений терапевта, отзыв и предпросмотр для экрана
// согласия (инцидент 2026-10-26). Фейк therapy.test-helpers.ts честно
// разбирает `clientId: null`, `{ gte }` и скоуп по therapistId.
import {
  listTherapyInvites,
  previewTherapyInvite,
  revokeTherapyInvite,
} from './therapy-invite-list';
import { createTherapyInvite, INVITE_TTL_MS } from './therapy-invite';
import { makeRelationPrismaMock, type Rel } from './therapy.test-helpers';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('../telegram/telegram.constants', () => ({
  ...jest.requireActual('../telegram/telegram.constants'),
  BOT_USERNAME: 'SchemeHappensBot',
}));

const T1 = 100n;
const T2 = 200n;
const CLIENT = 555n;

const rel = (over: Partial<Rel>): Rel => ({
  id: 1,
  therapistId: T1,
  clientId: null,
  status: 'pending',
  code: 'AAAAAAAAAAAA',
  createdAt: new Date(),
  ...over,
});

function db(rels: Rel[]) {
  return makeRelationPrismaMock(rels) as unknown as PrismaService;
}

describe('listTherapyInvites', () => {
  it('приглашение с именем из «Новый клиент» видно в списке с этим именем, кодом и ссылкой', async () => {
    const rels: Rel[] = [];
    const prisma = db(rels);
    const { code, url } = await createTherapyInvite(prisma, T1, '  Мария К. ');
    const list = await listTherapyInvites(prisma, T1);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ code, url, alias: 'Мария К.' });
    expect(Date.parse(list[0].expiresAt) - Date.parse(list[0].createdAt)).toBe(
      INVITE_TTL_MS,
    );
  });

  it('без имени — alias null', async () => {
    const prisma = db([]);
    await createTherapyInvite(prisma, T1);
    expect((await listTherapyInvites(prisma, T1))[0].alias).toBeNull();
  });

  it('только живые свои: принятые, просроченные, офлайн-клиенты и чужие не попадают', async () => {
    const list = await listTherapyInvites(
      db([
        rel({ id: 1, code: 'LIVE00000001' }),
        rel({ id: 2, status: 'active', clientId: CLIENT }),
        rel({ id: 3, createdAt: new Date(Date.now() - INVITE_TTL_MS - 1000) }),
        rel({ id: 4, status: 'active' }), // офлайн-клиент: active, clientId null
        rel({ id: 5, therapistId: T2 }),
      ]),
      T1,
    );
    expect(list.map((i) => i.code)).toEqual(['LIVE00000001']);
  });
});

describe('revokeTherapyInvite', () => {
  it('своё ждущее приглашение удаляется, код больше не действует', async () => {
    const rels = [rel({ id: 7 })];
    await expect(revokeTherapyInvite(db(rels), T1, 7)).resolves.toBe(true);
    expect(rels).toHaveLength(0);
  });

  it('чужое приглашение, принятая связь и офлайн-клиент не задеваются', async () => {
    const rels = [
      rel({ id: 1, therapistId: T2 }),
      rel({ id: 2, status: 'active', clientId: CLIENT }),
      rel({ id: 3, status: 'active' }),
    ];
    const prisma = db(rels);
    for (const id of [1, 2, 3])
      await expect(revokeTherapyInvite(prisma, T1, id)).resolves.toBe(false);
    expect(rels).toHaveLength(3);
  });
});

describe('previewTherapyInvite', () => {
  function withTherapist(rels: Rel[], firstName: string | null) {
    const prisma = makeRelationPrismaMock(rels);
    const findUnique = prisma.therapyRelation.findUnique;
    return {
      therapyRelation: {
        findUnique: async (args: { where: { code: string } }) => {
          const r = await findUnique(args);
          return r ? { ...r, therapist: { firstName } } : null;
        },
      },
    } as unknown as PrismaService;
  }

  it('живой код → имя терапевта; код вводят как угодно (строчные, пробелы)', async () => {
    const prisma = withTherapist([rel({ code: 'ABCDEF123456' })], 'Анна');
    await expect(
      previewTherapyInvite(prisma, CLIENT, ' abcdef123456 '),
    ).resolves.toEqual({ therapistName: 'Анна' });
  });

  it('имени в профиле нет → null, а не выдуманное', async () => {
    const prisma = withTherapist([rel({})], null);
    await expect(
      previewTherapyInvite(prisma, CLIENT, 'AAAAAAAAAAAA'),
    ).resolves.toEqual({ therapistName: null });
  });

  it('неизвестный, принятый, просроченный и свой код → null (то же правило, что у подключения)', async () => {
    const cases: [Rel[], bigint][] = [
      [[], CLIENT],
      [[rel({ status: 'active', clientId: 9n })], CLIENT],
      [
        [rel({ createdAt: new Date(Date.now() - INVITE_TTL_MS - 1000) })],
        CLIENT,
      ],
      [[rel({})], T1],
    ];
    for (const [rels, who] of cases)
      await expect(
        previewTherapyInvite(withTherapist(rels, 'Анна'), who, 'AAAAAAAAAAAA'),
      ).resolves.toBeNull();
  });
});
