// Аудит 2026-10, High: `recover` (потерянный ответ ротации) раньше
// выдавался БЕЗ счёта, и два участника цепочки — вор со старым токеном и
// жертва — по очереди получали новые пары вечно, `theft` не срабатывал.
// Тест гоняет настоящий AuthService поверх stateful-фейка Prisma: цепочку
// строит сам сервис (ротация + recover), а не руками вписанные строки.
// Плюс регрессия R2: logout закрывает всю family, а не одну строку.
import { UnauthorizedException } from '@nestjs/common';
import {
  createFakeTable,
  createFakeTransaction,
  Row,
} from '../test-support/fake-prisma.spec-helper';
import { AuthService } from './auth.service';

function makeService() {
  const webSessions: Row[] = [];
  const webSession = createFakeTable(webSessions, {
    defaults: { revokedAt: null, replacedByHash: null, recoveredAt: null },
  });
  const prisma: any = { webSession };
  prisma.$transaction = createFakeTransaction<Row>(prisma);
  const config = {
    getOrThrow: (k: string) =>
      ({
        JWT_SECRET: 'test-jwt-secret',
        BOT_TOKEN: '1:T',
        WEBAPP_URL: 'https://x',
      })[k],
  } as any;
  const securityLog = { log: jest.fn() } as any;
  const svc = new AuthService(prisma, config, securityLog, {} as any);
  return { svc, webSessions, securityLog };
}

const reject = (svc: AuthService, raw: string) =>
  expect(svc.rotateRefreshToken(raw)).rejects.toThrow(UnauthorizedException);

describe('refresh: бюджет восстановлений (чередующееся использование цепочки)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-03T12:00:00.000Z') });
  });
  afterEach(() => jest.useRealTimers());

  async function startChain() {
    const ctx = makeService();
    const r0 = (await ctx.svc.issueTokens(1n)).refreshToken;
    // Жертва ротировала R0→R1 штатно; вор тем временем унёс R0.
    const r1 = (await ctx.svc.rotateRefreshToken(r0)).refreshToken;
    return { ...ctx, r0, r1 };
  }

  it('вор и жертва по очереди: два восстановления проходят, третье — кража, семья отозвана, алерт', async () => {
    const { svc, webSessions, securityLog, r0, r1 } = await startChain();

    // Вор предъявляет R0 → recover №1 (R1 погашен, вору R2).
    const stolen = await svc.rotateRefreshToken(r0);
    expect(stolen.rotated).toBe(true);
    const r2 = stolen.refreshToken;
    // Жертва предъявляет R1 → recover №2 (R2 погашен, жертве R3).
    const victim = await svc.rotateRefreshToken(r1);
    expect(victim.rotated).toBe(true);
    const r3 = victim.refreshToken;
    expect(securityLog.log).not.toHaveBeenCalled();

    // Вор предъявляет R2 → третье восстановление за сутки = кража.
    await reject(svc, r2);
    expect(securityLog.log).toHaveBeenCalledTimes(1);
    expect(securityLog.log).toHaveBeenCalledWith(
      'refresh_token_reuse',
      expect.objectContaining({ userId: 1n }),
    );
    // Вся семья мертва, в том числе последний выданный жертве R3.
    expect(webSessions.filter((r) => !r.revokedAt)).toHaveLength(0);
    await reject(svc, r3);
  });

  it('один потерянный ответ — recover работает, алерта нет', async () => {
    const { svc, securityLog, r0 } = await startChain();
    const recovered = await svc.rotateRefreshToken(r0);
    expect(recovered.rotated).toBe(true);
    expect(
      (await svc.rotateRefreshToken(recovered.refreshToken)).accessToken,
    ).toEqual(expect.any(String));
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  it('поздний ответ старой ротации: два восстановления подряд проходят', async () => {
    const { svc, securityLog, r0, r1 } = await startChain();
    expect((await svc.rotateRefreshToken(r0)).rotated).toBe(true); // №1
    // Опоздавший живой ответ A→B: клиент предъявляет R1.
    expect((await svc.rotateRefreshToken(r1)).rotated).toBe(true); // №2
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  it('восстановления старше 24 часов не считаются', async () => {
    const { svc, securityLog, r0, r1 } = await startChain();
    const r2 = (await svc.rotateRefreshToken(r0)).refreshToken; // №1
    await svc.rotateRefreshToken(r1); // №2
    jest.setSystemTime(new Date('2026-10-04T13:00:00.000Z')); // +25 ч
    const again = await svc.rotateRefreshToken(r2);
    expect(again.rotated).toBe(true); // не кража
    expect(securityLog.log).not.toHaveBeenCalled();
  });
});

describe('logout: отзыв всей family (аудит 2026-10, R2)', () => {
  it('после revokeSession другой живой токен той же family отклоняется', async () => {
    const { svc, webSessions } = makeService();
    const victim = (await svc.issueTokens(1n)).refreshToken;
    // Вор держит соседний живой токен той же family.
    const family = webSessions[0].family;
    const thiefRaw = 'thief-raw-token';
    webSessions.push({
      id: 'thief',
      userId: 1n,
      tokenHash: require('crypto')
        .createHash('sha256')
        .update(thiefRaw)
        .digest('hex'),
      family,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    // Чужая семья того же пользователя (другое устройство) не затрагивается.
    const other = (await svc.issueTokens(1n)).refreshToken;

    await svc.revokeSession(victim);

    await reject(svc, thiefRaw);
    await reject(svc, victim);
    expect((await svc.rotateRefreshToken(other)).accessToken).toEqual(
      expect.any(String),
    );
  });

  it('неизвестный токен — тихо, без ошибок', async () => {
    const { svc } = makeService();
    await expect(svc.revokeSession('garbage')).resolves.toBeUndefined();
  });
});
