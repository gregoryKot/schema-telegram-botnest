import { joinTherapyAsClient, ALREADY_CONNECTED_ERROR } from './therapy-invite';
import type { PrismaService } from '../prisma/prisma.service';

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
