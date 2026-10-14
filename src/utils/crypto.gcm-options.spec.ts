// Контракт GCM в crypto.ts: оба шифра создаются с явным `authTagLength: 16`.
//
// Поведением это не проверить: тэг у нас всегда ровно 16 байт, а умолчание
// Node для создаваемого шифра — тоже 16, так что без опции всё работает
// ИДЕНТИЧНО. Но опция — не украшение: без неё `createDecipheriv` принимает
// укороченные тэги (4–16 байт), то есть подделку сделать на порядок проще.
// Именно поэтому она закреплена в коде комментарием (semgrep gcm-no-tag-length)
// и именно поэтому её тихое исчезновение при рефакторинге мутационный прогон
// (волна А) находил выжившим мутантом `{}` на месте объекта опций. Единственный
// способ это поймать — смотреть, с чем зовутся createCipheriv/createDecipheriv.
const mockCipherOptions: unknown[] = [];
const mockDecipherOptions: unknown[] = [];

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    createCipheriv: (...args: unknown[]) => {
      mockCipherOptions.push(args[3]);
      return actual.createCipheriv(...args);
    },
    createDecipheriv: (...args: unknown[]) => {
      mockDecipherOptions.push(args[3]);
      return actual.createDecipheriv(...args);
    },
  };
});

type CryptoModule = typeof import('./crypto');

const ORIGINAL_ENV = { ...process.env };

function loadCrypto(): CryptoModule {
  process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  process.env.ENCRYPTION_KEY_OLD = '';
  process.env.NODE_ENV = 'test';
  let mod: CryptoModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./crypto') as CryptoModule;
  });
  return mod!;
}

beforeEach(() => {
  mockCipherOptions.length = 0;
  mockDecipherOptions.length = 0;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('crypto.ts: явная длина GCM-тэга', () => {
  it('encrypt создаёт шифр с authTagLength: 16', () => {
    const { encrypt } = loadCrypto();
    encrypt('текст');
    expect(mockCipherOptions).toEqual([{ authTagLength: 16 }]);
  });

  it('decrypt создаёт дешифратор с authTagLength: 16', () => {
    const { encrypt, decrypt } = loadCrypto();
    const blob = encrypt('текст')!;
    expect(decrypt(blob)).toBe('текст');
    expect(mockDecipherOptions).toEqual([{ authTagLength: 16 }]);
  });
});
