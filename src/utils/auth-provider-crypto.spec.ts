// D-9 (аудит 2026-10): AuthProvider.email/displayName шифруются в БД. Хелпер —
// единственная точка записи/чтения для src/auth/** и экспорта; тест держит
// контракт: шифрует только PII-поля, ключ лукапа (providerId) не трогает,
// старые строки с открытым текстом читает как есть.
// crypto.ts читает ключ на загрузке — модули грузятся после установки env.
type Mod = typeof import('./auth-provider-crypto');
let mod: Mod;
let decrypt: (v: string | null | undefined) => string | null;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'ef'.repeat(32);
  process.env.NODE_ENV = 'test';
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  mod = require('./auth-provider-crypto') as Mod;
  decrypt = (require('./crypto') as typeof import('./crypto')).decrypt;
  /* eslint-enable @typescript-eslint/no-require-imports */
});

describe('auth-provider-crypto', () => {
  it('encrypt: email и displayName шифруются, остальные поля нетронуты', () => {
    const out = mod.encryptAuthProviderFields({
      userId: 7n,
      provider: 'google',
      providerId: 'sub-123',
      email: 'anya@example.com',
      displayName: 'Аня',
    });
    expect(out.provider).toBe('google');
    expect(out.providerId).toBe('sub-123'); // лукап-ключ остаётся открытым
    expect(out.userId).toBe(7n);
    expect(out.email).not.toBe('anya@example.com');
    expect(decrypt(out.email)).toBe('anya@example.com');
    expect(decrypt(out.displayName)).toBe('Аня');
  });

  it('undefined/null не превращаются в шифротекст (update без поля не затирает его)', () => {
    const out = mod.encryptAuthProviderFields({
      displayName: undefined,
      email: null,
    });
    expect(out.displayName).toBeUndefined();
    expect(out.email).toBeNull();
  });

  it('read-after-write: записанное читается обратно, legacy-plaintext тоже', () => {
    const written = mod.encryptAuthProviderFields({
      email: 'a@example.com',
      displayName: 'Аня',
    });
    expect(mod.decryptAuthProviderRow(written)).toEqual({
      email: 'a@example.com',
      displayName: 'Аня',
    });
    expect(
      mod.decryptAuthProviderRow({
        email: 'old@example.com',
        displayName: null,
      }),
    ).toEqual({ email: 'old@example.com', displayName: null });
  });
});
