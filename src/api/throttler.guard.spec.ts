import { UserThrottlerGuard } from './throttler.guard';

// getTracker использует только req (не this), поэтому конструктор ThrottlerGuard
// с его зависимостями не нужен — берём прототип напрямую.
const guard = Object.create(UserThrottlerGuard.prototype);
const track = (req: any): Promise<string> => guard.getTracker(req);

function jwtWithSub(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `header.${payload}.sig`;
}

describe('UserThrottlerGuard.getTracker', () => {
  it('по telegramUserId (per-user bucket)', async () => {
    expect(await track({ telegramUserId: 123, headers: {} })).toBe('uid:123');
  });

  it('по sub из JWT Bearer (декод без верификации — только бакетинг)', async () => {
    expect(await track({ headers: { authorization: `Bearer ${jwtWithSub('42')}` } })).toBe('uid:42');
  });

  it('битый Bearer → падает на IP', async () => {
    expect(await track({ headers: { authorization: 'Bearer not.a.jwt' }, ip: '1.2.3.4' })).toBe('1.2.3.4');
  });

  it('валидный JWT без sub → падает на IP', async () => {
    const payload = Buffer.from(JSON.stringify({ foo: 1 })).toString('base64url');
    expect(await track({ headers: { authorization: `Bearer h.${payload}.s` }, ip: '2.2.2.2' })).toBe('2.2.2.2');
  });

  it('initData с user без id → падает на IP', async () => {
    const initData = new URLSearchParams({ user: JSON.stringify({ name: 'x' }) }).toString();
    expect(await track({ headers: { 'x-telegram-init-data': initData }, ip: '3.3.3.3' })).toBe('3.3.3.3');
  });

  it('по user.id из Telegram initData', async () => {
    const initData = new URLSearchParams({ user: JSON.stringify({ id: 777 }) }).toString();
    expect(await track({ headers: { 'x-telegram-init-data': initData } })).toBe('uid:777');
  });

  it('битый initData → падает на IP', async () => {
    expect(await track({ headers: { 'x-telegram-init-data': 'user=%7Bбит' }, ip: '9.9.9.9' })).toBe('9.9.9.9');
  });

  it('ничего нет → IP', async () => {
    expect(await track({ headers: {}, ip: '5.5.5.5' })).toBe('5.5.5.5');
  });

  it('ничего и нет IP → "unknown"', async () => {
    expect(await track({ headers: {} })).toBe('unknown');
  });

  it('telegramUserId имеет приоритет над Bearer', async () => {
    expect(await track({ telegramUserId: 1, headers: { authorization: `Bearer ${jwtWithSub('999')}` } })).toBe('uid:1');
  });
});
