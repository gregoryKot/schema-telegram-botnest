// Ретеншен входных строк (D-9, аудит 2026-10): WebSession (30 дней после
// отзыва/истечения) и EmailToken (7 дней после истечения/использования).
import { SessionRetentionService } from './session-retention.service';

const NOW = new Date('2026-10-04T04:23:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function make(opts: { fail?: boolean } = {}) {
  const prisma = {
    webSession: {
      deleteMany: jest.fn(async () => {
        if (opts.fail) throw new Error('db down');
        return { count: 3 };
      }),
    },
    emailToken: { deleteMany: jest.fn(async () => ({ count: 2 })) },
  };
  return { prisma, service: new SessionRetentionService(prisma as never) };
}

describe('SessionRetentionService.cleanup', () => {
  it('WebSession: отозванные или истёкшие раньше «сейчас − 30 дней»', async () => {
    const { prisma, service } = make();
    await service.cleanup(NOW);
    expect(prisma.webSession.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ revokedAt: { lt: day(30) } }, { expiresAt: { lt: day(30) } }],
      },
    });
  });

  it('EmailToken: истёкшие или использованные раньше «сейчас − 7 дней»', async () => {
    const { prisma, service } = make();
    await service.cleanup(NOW);
    expect(prisma.emailToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ expiresAt: { lt: day(7) } }, { usedAt: { lt: day(7) } }],
      },
    });
  });

  // Живую сессию (не отозвана, не истекла) условие не затрагивает: оба
  // предиката — «lt» по датам, которых у живой сессии нет в прошлом.
  it('возвращает число удалённых строк', async () => {
    const { service } = make();
    await expect(service.cleanup(NOW)).resolves.toEqual({
      sessions: 3,
      tokens: 2,
    });
  });

  it('ошибка БД не бросается наружу (крон не падает), токены почты не трогаются', async () => {
    const { prisma, service } = make({ fail: true });
    await expect(service.cleanup(NOW)).resolves.toEqual({
      sessions: 0,
      tokens: 0,
    });
    expect(prisma.emailToken.deleteMany).not.toHaveBeenCalled();
  });
});
