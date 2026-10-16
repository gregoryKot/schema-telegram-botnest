// Крон уборки ThrottleHit был единственным кодом, удаляющим строки из общего
// счётчика денежных ручек (POST /api/booking/book), и не имел ни одного теста
// (аудит 2026-10). Правка `lt` -> `gt` снесла бы живые блокировки каждый час.
// Здесь проверяется смысл условия на таблице с SQL-семантикой NULL; перевод
// условия в SQL и сравнение с timestamp(3) доказывает живой спек
// test/throttle-storage.e2e-spec.ts.
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';
import { ThrottleHitCleanupService } from './throttle-hit.cleanup';

const NOW = new Date('2026-10-16T12:00:00.000Z');
const H = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

function setup(rows: Row[]) {
  const table = createFakeTable(rows, { idField: 'key' });
  const service = new ThrottleHitCleanupService({
    throttleHit: table,
  } as unknown as PrismaService);
  return { service, table };
}

const survivors = (table: { _rows: Row[] }) =>
  table._rows.map((r) => r.key as string).sort();

describe('ThrottleHitCleanupService.cleanup', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const fixture = (): Row[] => [
    { key: 'live', hits: 1, expiresAt: at(H), blockedUntil: null },
    { key: 'expired-1h', hits: 1, expiresAt: at(-H), blockedUntil: null },
    { key: 'expired-2d', hits: 1, expiresAt: at(-48 * H), blockedUntil: null },
    {
      key: 'expired-2d-block-lifted',
      hits: 9,
      expiresAt: at(-48 * H),
      blockedUntil: at(-H),
    },
    {
      // Во время блока expiresAt не сдвигается (postgres-throttle-storage),
      // поэтому окно давно истекло, а защищает строку только blockedUntil.
      key: 'expired-2d-block-active',
      hits: 9,
      expiresAt: at(-48 * H),
      blockedUntil: at(H),
    },
    { key: 'at-cutoff', hits: 1, expiresAt: at(-24 * H), blockedUntil: null },
  ];

  it('удаляет только строки старше суток без активного блока', async () => {
    const { service, table } = setup(fixture());
    await service.cleanup();
    expect(survivors(table)).toEqual([
      'at-cutoff',
      'expired-1h',
      'expired-2d-block-active',
      'live',
    ]);
  });

  it('сообщает в лог число удалённых строк', async () => {
    const { service } = setup(fixture());
    await service.cleanup();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Удалено устаревших ThrottleHit: 2');
  });

  it('молчит, когда убирать нечего', async () => {
    const { service, table } = setup([
      { key: 'live', hits: 1, expiresAt: at(H), blockedUntil: null },
    ]);
    await service.cleanup();
    expect(survivors(table)).toEqual(['live']);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
