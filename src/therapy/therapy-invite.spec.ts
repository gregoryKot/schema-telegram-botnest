import { joinTherapyAsClient, ALREADY_CONNECTED_ERROR } from './therapy-invite';
import type { PrismaService } from '../prisma/prisma.service';
import { attachOfflineCard } from './therapy-invite-attach';

jest.mock('./therapy-invite-attach', () => ({
  attachOfflineCard: jest.fn().mockResolvedValue(true),
}));
const attachMock = attachOfflineCard as jest.Mock;
beforeEach(() => attachMock.mockClear());

// Гонка двух кодов одного терапевта: findFirst(alreadyConnected) пропустил
// обоих, а частичный unique TherapyRelation_active_pair_key пропустил одного.
// Живой Postgres — test/merge-relations.e2e-spec.ts; здесь — ветка catch.
const pending = {
  code: 'ABC123',
  therapistId: 1n,
  clientId: null,
  status: 'pending',
  createdAt: new Date(),
};

function makeDb(updateMany: jest.Mock) {
  return {
    therapyRelation: {
      findUnique: jest.fn().mockResolvedValue(pending),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany,
    },
  } as unknown as PrismaService;
}

describe('joinTherapyAsClient — уникальность активной связи', () => {
  it('P2002 на updateMany (второй код того же терапевта) → true', async () => {
    const um = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    expect(await joinTherapyAsClient(makeDb(um), 2n, 'abc123')).toBe(true);
    expect(um).toHaveBeenCalledTimes(1);
  });

  it('другая ошибка updateMany пробрасывается', async () => {
    const um = jest.fn().mockRejectedValue(new Error('db down'));
    await expect(joinTherapyAsClient(makeDb(um), 2n, 'abc123')).rejects.toThrow(
      'db down',
    );
  });

  it('штатный захват: count 1 → true, count 0 → false', async () => {
    expect(
      await joinTherapyAsClient(
        makeDb(jest.fn().mockResolvedValue({ count: 1 })),
        2n,
        'abc123',
      ),
    ).toBe(true);
    expect(
      await joinTherapyAsClient(
        makeDb(jest.fn().mockResolvedValue({ count: 0 })),
        2n,
        'abc123',
      ),
    ).toBe(false);
  });

  it('другой активный терапевт по-прежнему ошибка, а не молчаливый успех', async () => {
    const db = makeDb(jest.fn());
    (db.therapyRelation.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 9 });
    await expect(joinTherapyAsClient(db, 2n, 'abc123')).rejects.toThrow(
      ALREADY_CONNECTED_ERROR,
    );
  });
});

// S8 (аудит 2026-11, решение владельца Р3): код карточки мог ввести кто
// угодно — данные карточки при join НЕ переносятся, связь ждёт сверки
// терапевтом (therapy-invite-card-claim.ts).
describe('joinTherapyAsClient — приглашение из офлайн-карточки', () => {
  const fromCard = { ...pending, id: 77, attachToId: 9 };
  const dbWith = (rel: unknown, alreadyConnected: unknown, count: number) => {
    const tx = {
      therapyRelation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const db = {
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
      therapyRelation: {
        findUnique: jest.fn().mockResolvedValue(rel),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(alreadyConnected)
          .mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count }),
      },
    } as unknown as PrismaService;
    return { db, tx };
  };

  it('захват: связь есть, данные карточки не переносятся, имя карточки снято', async () => {
    const { db } = dbWith(fromCard, null, 1);
    expect(await joinTherapyAsClient(db, 2n, 'abc123')).toBe(true);
    expect(attachMock).not.toHaveBeenCalled();
    expect(db.therapyRelation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { clientId: 2n, status: 'active', clientAlias: null },
      }),
    );
  });

  it('уже подключён: карточка не сливается, код гаснет, связь ждёт сверки', async () => {
    const { db, tx } = dbWith(fromCard, { id: 5 }, 0);
    expect(await joinTherapyAsClient(db, 2n, 'abc123')).toBe(true);
    expect(attachMock).not.toHaveBeenCalled();
    expect(tx.therapyRelation.deleteMany).toHaveBeenCalledWith({
      where: { id: 77, status: 'pending', clientId: null },
    });
    expect(tx.therapyRelation.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { attachToId: 9 },
    });
  });

  it('уже подключён, код успел погаснуть (параллельный ввод) — отметки нет', async () => {
    const { db, tx } = dbWith(fromCard, { id: 5 }, 0);
    tx.therapyRelation.deleteMany.mockResolvedValue({ count: 0 });
    expect(await joinTherapyAsClient(db, 2n, 'abc123')).toBe(true);
    expect(tx.therapyRelation.update).not.toHaveBeenCalled();
  });

  it('захват не удался → false', async () => {
    const { db } = dbWith(fromCard, null, 0);
    expect(await joinTherapyAsClient(db, 2n, 'abc123')).toBe(false);
  });

  it('обычное приглашение: имя из «Новый клиент» остаётся, отметки сверки нет', async () => {
    const plain = dbWith({ ...pending, attachToId: null }, null, 1);
    expect(await joinTherapyAsClient(plain.db, 2n, 'abc123')).toBe(true);
    expect(plain.db.therapyRelation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { clientId: 2n, status: 'active' } }),
    );
    const again = dbWith({ ...pending, attachToId: null }, { id: 5 }, 0);
    expect(await joinTherapyAsClient(again.db, 2n, 'abc123')).toBe(true);
    expect(again.db.$transaction).not.toHaveBeenCalled();
  });
});
