// DbOutageMonitorService — сторожок, который закрывает аварию БД (см. шапку
// db-outage.service.ts и src/logger/db-outage.ts). dbOutage — общий
// синглтон с AlertLogger, поэтому состояние выставляем напрямую через
// dbOutage.note()/reset() и сбрасываем между тестами. notifyAdminWithFallback
// мокается на границе модуля, как в alert.logger.spec.ts.
import { DbOutageMonitorService } from './db-outage.service';
import { dbOutage } from '../logger/db-outage';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const mockedNotify = notifyAdminWithFallback as jest.Mock;

function makePrisma(queryRaw: jest.Mock): PrismaService {
  return { $queryRaw: queryRaw } as unknown as PrismaService;
}

beforeEach(() => {
  mockedNotify.mockClear();
  dbOutage.reset();
});

describe('DbOutageMonitorService.probe', () => {
  it('без открытой аварии не делает запрос к БД и не шлёт DM', async () => {
    // Сторожок висит на кроне каждую минуту: в спокойное время он обязан
    // выходить ДО обращения к базе, иначе сам станет постоянной нагрузкой.
    const queryRaw = jest.fn(() => {
      throw new Error('probe не должен ходить в БД без открытой аварии');
    });
    const service = new DbOutageMonitorService(makePrisma(queryRaw));
    await expect(service.probe()).resolves.toBeUndefined();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
    expect(dbOutage.isOpen).toBe(false);
  });

  it('авария открыта, $queryRaw падает — DM о восстановлении не уходит', async () => {
    dbOutage.note("Can't reach database server", 1_000_000);
    const queryRaw = jest.fn().mockRejectedValue(new Error('still down'));
    const service = new DbOutageMonitorService(makePrisma(queryRaw));
    await service.probe();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(mockedNotify).not.toHaveBeenCalled();
    expect(dbOutage.isOpen).toBe(true);
  });

  it('авария открыта, $queryRaw проходит — ровно один DM о восстановлении, повтор молчит', async () => {
    dbOutage.note("Can't reach database server", 1_000_000);
    const queryRaw = jest.fn().mockResolvedValue(undefined);
    const service = new DbOutageMonitorService(makePrisma(queryRaw));

    await service.probe();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain('снова отвечает');
    expect(dbOutage.isOpen).toBe(false);

    mockedNotify.mockClear();
    await service.probe(); // авария уже закрыта — probe выходит до $queryRaw
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});
