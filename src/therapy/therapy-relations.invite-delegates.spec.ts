// Делегаты приглашений в TherapyRelationsService: сервис — тонкая обёртка над
// therapy-invite-list.ts (логику тех функций проверяет therapy-invite-list.spec.ts).
// Здесь — что обёртки возвращают результат, а не пустой блок (ночной
// мутационный гейт golden-auth, 2026-11: три NoCoverage-мутанта).
import { TherapyRelationsService } from './therapy-relations.service';

// Имя бота без дефолта: ссылка-приглашение строится от него, как на проде.
jest.mock('../telegram/telegram.constants', () => ({
  ...jest.requireActual('../telegram/telegram.constants'),
  BOT_USERNAME: 'SchemeHappensBot',
}));

describe('TherapyRelationsService — делегаты приглашений', () => {
  const createdAt = new Date('2026-11-01T10:00:00Z');
  const makeDelegating = () => {
    const prisma = {
      therapyRelation: {
        findMany: jest.fn(async () => [
          { id: 7, code: 'ABC12345', clientAlias: null, createdAt },
        ]),
        deleteMany: jest.fn(async () => ({ count: 1 })),
        findUnique: jest.fn(async () => null),
      },
    };
    return {
      prisma,
      service: new TherapyRelationsService(prisma as never, {} as never),
    };
  };

  it('listInvites возвращает живые приглашения терапевта', async () => {
    const { service, prisma } = makeDelegating();
    const res = await service.listInvites(3n);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ id: 7, code: 'ABC12345', alias: null });
    expect(prisma.therapyRelation.findMany).toHaveBeenCalledTimes(1);
  });

  it('revokeInvite возвращает true, когда запись удалена', async () => {
    const { service, prisma } = makeDelegating();
    await expect(service.revokeInvite(3n, 7)).resolves.toBe(true);
    expect(prisma.therapyRelation.deleteMany).toHaveBeenCalledWith({
      where: { id: 7, therapistId: 3n, status: 'pending', clientId: null },
    });
  });

  it('previewInvite по неизвестному коду возвращает null', async () => {
    const { service } = makeDelegating();
    await expect(service.previewInvite(5n, 'zzz')).resolves.toBeNull();
  });
});
