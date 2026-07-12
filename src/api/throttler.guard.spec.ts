// Регрессия на находку аудита 2026-07 (S-1): троттлинг-бакет строился по
// НЕВЕРИФИЦИРОВАННОМУ `sub` из JWT / `user.id` из initData (подпись проверяется
// только следующим гардом). Атакующий ротировал фейковый sub в каждом запросе →
// свежий бакет на запрос, rate-limit фактически отсутствовал.
// Теперь неверифицированные идентификаторы всегда скованы с IP.
import { UserThrottlerGuard } from './throttler.guard';

// getTracker — protected; для теста открываем через наследника.
class TestableGuard extends UserThrottlerGuard {
  track(req: Record<string, any>): Promise<string> {
    return this.getTracker(req);
  }
}

function fakeJwt(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub, type: 'access' })).toString(
    'base64url',
  );
  return `header.${payload}.signature`;
}

describe('UserThrottlerGuard.getTracker', () => {
  // ThrottlerGuard-конструктор не используется в getTracker — создаём без DI.
  const guard = Object.create(TestableGuard.prototype) as TestableGuard;

  it('верифицированный userId (после auth-гарда) — чистый uid-бакет', async () => {
    await expect(
      guard.track({ telegramUserId: 42, ip: '1.2.3.4' }),
    ).resolves.toBe('uid:42');
  });

  it('неверифицированный JWT sub скован с IP', async () => {
    const req = {
      headers: { authorization: `Bearer ${fakeJwt('999')}` },
      ip: '1.2.3.4',
    };
    await expect(guard.track(req)).resolves.toBe('uid:999|ip:1.2.3.4');
  });

  it('ротация фейкового sub с одного IP НЕ даёт независимых бакетов (общий IP-суффикс)', async () => {
    const t1 = await guard.track({
      headers: { authorization: `Bearer ${fakeJwt('1')}` },
      ip: '1.2.3.4',
    });
    const t2 = await guard.track({
      headers: { authorization: `Bearer ${fakeJwt('2')}` },
      ip: '1.2.3.4',
    });
    expect(t1.endsWith('|ip:1.2.3.4')).toBe(true);
    expect(t2.endsWith('|ip:1.2.3.4')).toBe(true);
  });

  it('неверифицированный initData user.id скован с IP', async () => {
    const initData = `user=${encodeURIComponent(JSON.stringify({ id: 777 }))}&hash=x`;
    const req = {
      headers: { 'x-telegram-init-data': initData },
      ip: '5.6.7.8',
    };
    await expect(guard.track(req)).resolves.toBe('uid:777|ip:5.6.7.8');
  });

  it('битый JWT / initData — fallback на IP', async () => {
    await expect(
      guard.track({
        headers: { authorization: 'Bearer not-a-jwt' },
        ip: '9.9.9.9',
      }),
    ).resolves.toBe('9.9.9.9');
    await expect(
      guard.track({
        headers: { 'x-telegram-init-data': 'user=%7Bbroken' },
        ip: '9.9.9.9',
      }),
    ).resolves.toBe('9.9.9.9');
  });

  it('без кредов и IP — unknown', async () => {
    await expect(guard.track({ headers: {} })).resolves.toBe('unknown');
  });
});
