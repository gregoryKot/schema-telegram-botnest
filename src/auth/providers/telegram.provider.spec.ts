import * as crypto from 'crypto';
import { TelegramProvider } from './telegram.provider';

const BOT_TOKEN = '123456:test-secret';

// Подписать данные так же, как Telegram Login Widget (secret_key = SHA256(bot_token))
function sign(fields: Record<string, string>): string {
  const checkString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  return crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
}

function makeProvider() {
  const config = { getOrThrow: jest.fn().mockReturnValue(BOT_TOKEN) } as any;
  return new TelegramProvider(config);
}

const now = () => Math.floor(Date.now() / 1000);

describe('TelegramProvider.verifyClientData', () => {
  it('валидная подпись → ProviderIdentity', () => {
    const fields = { id: '777', first_name: 'Аня', auth_date: String(now()) };
    const identity = makeProvider().verifyClientData({ ...fields, hash: sign(fields) });
    expect(identity).toEqual({ providerId: '777', displayName: 'Аня' });
  });

  it('нет hash → 401 Missing hash', () => {
    expect(() => makeProvider().verifyClientData({ id: '1', auth_date: String(now()) }))
      .toThrow('Missing hash');
  });

  it('hash неверного формата (не 64 hex) → 401 Malformed hash', () => {
    expect(() => makeProvider().verifyClientData({ id: '1', auth_date: String(now()), hash: 'abc' }))
      .toThrow('Malformed hash');
  });

  it('протухший auth_date (>24ч) → 401 expired', () => {
    const old = String(now() - 90_000);
    const hash = 'a'.repeat(64); // формат верный, до проверки подписи дело не дойдёт
    expect(() => makeProvider().verifyClientData({ id: '1', auth_date: old, hash }))
      .toThrow('expired');
  });

  it('неверная подпись → 401 Invalid Telegram signature', () => {
    const fields = { id: '1', auth_date: String(now()) };
    const wrong = 'b'.repeat(64);
    expect(() => makeProvider().verifyClientData({ ...fields, hash: wrong }))
      .toThrow('Invalid Telegram signature');
  });

  it('валидная подпись, но нет id → 401 Missing Telegram user id', () => {
    const fields = { first_name: 'Без id', auth_date: String(now()) };
    expect(() => makeProvider().verifyClientData({ ...fields, hash: sign(fields) }))
      .toThrow('Missing Telegram user id');
  });

  it('игнорирует null-поля при построении check-string', () => {
    const fields = { id: '5', auth_date: String(now()) };
    const data = { ...fields, photo_url: null, hash: sign(fields) };
    expect(makeProvider().verifyClientData(data).providerId).toBe('5');
  });
});
