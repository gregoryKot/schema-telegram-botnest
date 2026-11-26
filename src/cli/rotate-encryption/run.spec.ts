// Запуск ротации: код выхода, вывод и отключение от базы. Живой процесс целиком —
// test/key-rotation.e2e-spec.ts; здесь то же поведение без базы.
import type { PrismaClient } from '@prisma/client';
import { loadWithKeys } from '../../test-support/load-with-keys';

const KEY_A = 'aa'.repeat(32);
const KEY_B = 'bb'.repeat(32);

const { runRotation } = loadWithKeys(
  { key: KEY_B, old: KEY_A },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('./run') as typeof import('./run'),
);

// Клиент без данных: каждая модель отдаёт пустую таблицу; broken — падающие модели.
function emptyClient(broken: string[] = []) {
  const disconnect = jest.fn(async () => undefined);
  const client = new Proxy(
    {},
    {
      get: (_t, name: string) =>
        name === '$disconnect'
          ? disconnect
          : {
              findMany: async () => {
                if (broken.includes(name))
                  throw new Error('таблица недоступна');
                return [];
              },
              updateMany: async () => ({ count: 0 }),
            },
    },
  );
  return { client: client as unknown as PrismaClient, disconnect };
}

describe('runRotation', () => {
  it('всё ротировано: код 0, «Готово» в выводе, соединение закрыто', async () => {
    const { client, disconnect } = emptyClient();
    const lines: string[] = [];

    const code = await runRotation({
      key: KEY_B,
      connect: () => client,
      log: (l) => lines.push(l),
    });

    expect(code).toBe(0);
    expect(lines.at(-1)).toBe(
      '\nГотово: перешифровано строк — 0. ENCRYPTION_KEY_OLD можно убирать.',
    );
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('модель упала: код 1, «НЕ ротировано» в выводе, соединение всё равно закрыто', async () => {
    const { client, disconnect } = emptyClient(['userSafePlace']);
    const lines: string[] = [];

    const code = await runRotation({
      key: KEY_B,
      connect: () => client,
      log: (l) => lines.push(l),
    });

    expect(code).toBe(1);
    expect(lines).toContain('✗ userSafePlace: таблица недоступна');
    expect(lines.at(-1)).toContain('НЕ ротировано: [userSafePlace]');
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, '', 'не-ключ', 'ab'.repeat(31)])(
    'ключ %p невалиден: исключение до подключения к базе',
    async (key) => {
      const connect = jest.fn();

      await expect(
        runRotation({ key, connect, log: () => undefined }),
      ).rejects.toThrow('ENCRYPTION_KEY не задан или не 64 hex-символа');
      expect(connect).not.toHaveBeenCalled();
    },
  );
});
