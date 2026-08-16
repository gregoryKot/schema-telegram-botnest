// Поведенческие тесты treq:approve|reject (инлайн-кнопки заявок терапевта на
// TelegramAdminService). Перенесено из telegram.service.spec.ts (happy-path)
// и telegram.service.consent.spec.ts (ветка ошибки approve) при выносе
// админ-хендлеров в отдельный сервис (правило №10 CLAUDE.md — лимит размера
// файла). /zv, /stats, /testdonate — telegram.admin.service.spec.ts;
// /zayavki, /broadcast — telegram.admin.service.broadcast.spec.ts.
import { Logger } from '@nestjs/common';
import { TelegramAdminService } from './telegram.admin.service';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

const OLD_ADMIN_ID = process.env.ADMIN_ID;

function makeDeps(overrides: Record<string, any> = {}) {
  const adminStatsService = { ...overrides.adminStatsService };
  const statsReport = { ...overrides.statsReport };
  const healthyAdultService = { ...overrides.healthyAdultService };
  const accountService = { ...overrides.accountService };
  const therapistRequestService = {
    approve: jest.fn().mockResolvedValue(undefined),
    reject: jest.fn().mockResolvedValue(undefined),
    ...overrides.therapistRequestService,
  };
  const publisher = { ...overrides.publisher };
  const channelCheck = { ...overrides.channelCheck };
  const fakeBot = makeFakeBot();
  const service = new TelegramAdminService(
    fakeBot.bot,
    adminStatsService,
    statsReport,
    healthyAdultService,
    accountService,
    therapistRequestService,
    publisher,
    channelCheck,
  );
  return { service, fakeBot, therapistRequestService };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (OLD_ADMIN_ID === undefined) delete process.env.ADMIN_ID;
  else process.env.ADMIN_ID = OLD_ADMIN_ID;
});

describe('TelegramAdminService — treq:approve|reject (только админ)', () => {
  it('не-админ получает отказ, therapistRequestService не вызывается', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:approve:5', {
      from: { id: 1 }, // не 999
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('админ'),
    );
    expect(therapistRequestService.approve).not.toHaveBeenCalled();
  });

  it('админ approve вызывает approve(adminId, reqId)', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:approve:5', {
      from: { id: 999 },
    });
    expect(therapistRequestService.approve).toHaveBeenCalledWith(999, 5);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('одобрена'));
  });

  it('админ reject вызывает reject(adminId, reqId, "")', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:reject:5', {
      from: { id: 999 },
    });
    expect(therapistRequestService.reject).toHaveBeenCalledWith(999, 5, '');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('отклонена'),
    );
  });

  it('ADMIN_ID не задан на сервере — доступ закрыт даже якобы-совпадающему id', async () => {
    delete process.env.ADMIN_ID;
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:approve:5', {
      from: { id: 0 },
    });
    expect(therapistRequestService.approve).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('админ'),
    );
  });
});

describe('TelegramAdminService — treq action, ошибка approve/reject', () => {
  it('approve падает — answerCbQuery("Ошибка"), ошибка залогирована, не бросает', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const OLD = process.env.ADMIN_ID;
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps({
      therapistRequestService: {
        approve: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:approve:5', {
      from: { id: 999 },
    });
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith('Ошибка');
    if (OLD === undefined) delete process.env.ADMIN_ID;
    else process.env.ADMIN_ID = OLD;
  });
});
