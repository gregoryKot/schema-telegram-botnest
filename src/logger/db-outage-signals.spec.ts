// Отказ пула pg (аудит 2026-10, «isDbUnreachable не узнаёт отказ пула pg»):
// ошибки без кода Postgres `@prisma/adapter-pg` перебрасывает как есть
// (`convertDriverError`), и текст pg-pool не совпадал ни с одним признаком
// db-outage.ts — алерты такой аварии не схлопывались в одну «базу не отвечает».
// Записи с прода нет (логи Amvera только у владельца), поэтому образец — сам
// источник: тексты читаются из установленного pg-pool, а не пишутся руками.
// Сменит библиотека формулировку — краснеет первый тест, а не прод.
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { isConnectionError, isDbUnreachable } from './db-outage';
import { PG_POOL_SIGNALS } from './db-outage-signals';

// pg-pool — зависимость pg: ищем его рядом с pg, как его находит драйвер.
const PG_POOL_SRC = readFileSync(
  require.resolve('pg-pool', { paths: [dirname(require.resolve('pg'))] }),
  'utf8',
);
// Ровно те строки, которыми pg-pool отвечает на недоступную базу.
const POOL_ERRORS = [
  ...PG_POOL_SRC.matchAll(/new Error\('((?:timeout|Connection)[^']*)'/g),
].map((m) => m[1]);

describe('признаки отказа пула pg', () => {
  it('тексты взяты из установленного pg-pool, а не сочинены', () => {
    expect(POOL_ERRORS).toEqual(
      expect.arrayContaining([
        'timeout exceeded when trying to connect',
        'Connection terminated due to connection timeout',
      ]),
    );
    for (const signal of PG_POOL_SIGNALS) {
      expect(POOL_ERRORS.map((t) => t.toLowerCase())).toContain(signal);
    }
  });

  it.each(POOL_ERRORS)(
    'ошибка pg-pool «%s» без контекста БД — авария базы',
    (text) => {
      const err = new Error(text);
      expect(isDbUnreachable(err)).toBe(true);
      expect(isConnectionError(err)).toBe(true);
    },
  );

  it('ошибка pg-pool с причиной (cause) и в обёртке строки — тоже', () => {
    const cause = new Error('connect ETIMEDOUT 10.0.0.1:5432');
    const err = new Error('Connection terminated due to connection timeout', {
      cause,
    });
    expect(isDbUnreachable(err)).toBe(true);
    expect(
      isDbUnreachable(
        'processQueue failed: timeout exceeded when trying to connect',
      ),
    ).toBe(true);
  });

  // Контроль: признак пула не делает «аварией БД» любой таймаут — отказ
  // api.telegram.org по-прежнему не уезжает под заголовком про базу.
  it.each([
    ['request to https://api.telegram.org failed, reason: connect ETIMEDOUT'],
    ['Connection terminated'],
    ['timeout exceeded'],
  ])('контроль: «%s» без контекста БД — не авария базы', (text) => {
    expect(isDbUnreachable(new Error(text))).toBe(false);
  });
});
