// Serializable-транзакция с ретраем: формы конфликта сериализации у Prisma 7 с
// adapter-pg и сам цикл повтора. Форма «на COMMIT» записана с живого Postgres
// (test/notify-from-other.e2e-spec.ts, два одновременных запроса YSQ): до
// 2026-11 ловился только P2034, и такой конфликт уходил наружу 500.
import { ConflictException } from '@nestjs/common';
import {
  inSerializableTx,
  isSerializationFailure,
  SERIALIZATION_RETRIES,
} from './serializable-retry';

const onCommit = () =>
  Object.assign(new Error('TransactionWriteConflict'), {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '40001',
      originalMessage:
        'could not serialize access due to read/write dependencies among transactions',
      kind: 'TransactionWriteConflict',
    },
  });

describe('isSerializationFailure', () => {
  it('P2034, 40001 голого pg и DriverAdapterError на COMMIT — конфликт', () => {
    expect(isSerializationFailure({ code: 'P2034' })).toBe(true);
    expect(isSerializationFailure({ code: '40001' })).toBe(true);
    expect(isSerializationFailure(onCommit())).toBe(true);
  });

  it('прочие ошибки — нет (уникальность, обрыв связи, null)', () => {
    expect(isSerializationFailure({ code: 'P2002' })).toBe(false);
    expect(isSerializationFailure({ code: 'P1001' })).toBe(false);
    expect(
      isSerializationFailure({ cause: { kind: 'UniqueConstraintViolation' } }),
    ).toBe(false);
    expect(isSerializationFailure(null)).toBe(false);
    expect(isSerializationFailure('P2034')).toBe(false);
  });
});

describe('inSerializableTx', () => {
  const exhausted = () => new ConflictException('повтор не помог');

  const coded = (code: string) => Object.assign(new Error(code), { code });

  function prismaFailing(errors: Error[]) {
    const levels: unknown[] = [];
    const $transaction = jest.fn(
      (
        fn: (tx: never) => Promise<unknown>,
        o?: { isolationLevel?: string },
      ) => {
        levels.push(o?.isolationLevel);
        const err = errors.shift();
        return err ? Promise.reject(err) : fn({} as never);
      },
    );
    return { prisma: { $transaction } as never, $transaction, levels };
  }

  it('конфликт на COMMIT → повтор → результат второй попытки', async () => {
    const { prisma, $transaction, levels } = prismaFailing([onCommit()]);
    await expect(
      inSerializableTx(prisma, () => Promise.resolve('ok'), exhausted),
    ).resolves.toBe('ok');
    expect($transaction).toHaveBeenCalledTimes(2);
    expect(levels).toEqual(['Serializable', 'Serializable']);
  });

  it(`${SERIALIZATION_RETRIES} конфликта подряд → onExhausted()`, async () => {
    const { prisma, $transaction } = prismaFailing(
      Array.from({ length: SERIALIZATION_RETRIES }, () => coded('P2034')),
    );
    await expect(
      inSerializableTx(prisma, () => Promise.resolve('ok'), exhausted),
    ).rejects.toThrow('повтор не помог');
    expect($transaction).toHaveBeenCalledTimes(SERIALIZATION_RETRIES);
  });

  it('прочая ошибка не повторяется и уходит наверх как есть', async () => {
    const { prisma, $transaction } = prismaFailing([coded('P1001')]);
    await expect(
      inSerializableTx(prisma, () => Promise.resolve('ok'), exhausted),
    ).rejects.toMatchObject({ code: 'P1001' });
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});
