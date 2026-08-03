// Отказоустойчивость TelegramScheduleService: catch-up таймер onModuleInit не
// должен ронять процесс необработанным reject; processQueue различает
// временный обрыв соединения с БД (warn, без пейджинга админа) от реальной
// ошибки (error); kill-switch освобождает лок, если runProcessQueue завис
// дольше 4 минут — иначе бот перестаёт слать уведомления навсегда после
// одного зависшего тика. До этого файла все три ветки были непокрыты (см.
// отчёт покрытия src/telegram, аудит 2026-08).
import { Logger } from '@nestjs/common';
import { TelegramScheduleService } from './telegram.schedule.service';

function makeService(
  opts: {
    bot?: any;
    accountService?: any;
    notificationService?: any;
  } = {},
) {
  const botService: any = {
    getUserSettings: jest.fn().mockResolvedValue(null),
  };
  const analyticsService: any = {};
  const accountService: any = opts.accountService ?? {
    getAllUsersWithSettings: jest.fn().mockResolvedValue([]),
  };
  const pairsService: any = { getUserPairs: jest.fn().mockResolvedValue([]) };
  const notificationService: any = opts.notificationService ?? {
    getDue: jest.fn().mockResolvedValue([]),
  };
  const cadenceService: any = {};
  const plannerService: any = {
    planDay: jest.fn().mockResolvedValue(undefined),
  };
  const bot =
    opts.bot === undefined
      ? { telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) } }
      : opts.bot;
  const service = new TelegramScheduleService(
    bot,
    botService,
    analyticsService,
    accountService,
    pairsService,
    notificationService,
    cadenceService,
    plannerService,
  );
  return { service, accountService, notificationService };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('onModuleInit — 30с catch-up планировщика', () => {
  it('падение scheduleDailyReminders через catch-up — warn, не необработанный reject', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const accountService = {
      getAllUsersWithSettings: jest
        .fn()
        .mockRejectedValue(new Error('db down')),
    };
    const { service } = makeService({ accountService });
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(accountService.getAllUsersWithSettings).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Startup planner catch-up failed'),
    );
  });
});

describe('processQueue — верхнеуровневый catch (не путь конкретного уведомления)', () => {
  it('обрыв соединения с БД (ECONNREFUSED) — warn, не error (не будит админа зря)', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const notificationService = {
      getDue: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    };
    const { service } = makeService({ notificationService });
    await service.processQueue();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('processQueue DB connection error'),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('прочая ошибка (не сетевая) — логируется как error, не глушится молча', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const notificationService = {
      getDue: jest
        .fn()
        .mockRejectedValue(new Error('unexpected schema mismatch')),
    };
    const { service } = makeService({ notificationService });
    await service.processQueue();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('processQueue failed'),
      expect.anything(),
    );
  });
});

describe('processQueue — kill-switch на зависшем тике', () => {
  it('runProcessQueue висит > 4 минут — лок принудительно освобождается, следующий тик не блокируется навсегда', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    let resolveGetDue: (v: unknown[]) => void = () => {};
    const stuck = new Promise<unknown[]>((res) => {
      resolveGetDue = res;
    });
    const notificationService = {
      getDue: jest.fn().mockReturnValueOnce(stuck).mockResolvedValue([]),
    };
    const { service } = makeService({ notificationService });
    const first = service.processQueue(); // зависает на getDue()
    await jest.advanceTimersByTimeAsync(4 * 60_000 + 100);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('timed out after 4 min'),
    );
    // Лок сброшен kill-switch'ем — второй тик проходит, не видит isProcessing=true.
    await service.processQueue();
    expect(notificationService.getDue).toHaveBeenCalledTimes(2);
    resolveGetDue([]); // отпускаем первый вызов, чтобы промис не утёк за пределы теста
    await first;
  });
});
