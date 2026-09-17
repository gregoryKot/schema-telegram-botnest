// Пары: сводка по партнёру считается на лету из чужих (партнёрских) данных
// по partnerId, полученному из PairsService — не из тела запроса юзера.
// Проверяем именно арифметику агрегации (partnerIndex/partnerTodayDone/
// partnerWeekAvgs), т.к. это единственная реальная логика контроллера.
import { BadRequestException } from '@nestjs/common';
import { PairsController } from './pairs.controller';
import { NEED_IDS } from '../bot/bot.service';
import type { PairsService } from '../bot/pairs.service';
import type { BotService } from '../bot/bot.service';
import type { AccountService } from '../bot/account.service';
import type { BotAnalyticsService } from '../bot/bot.analytics.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

function allNeedsRated(value: number) {
  return Object.fromEntries(NEED_IDS.map((id) => [id, value]));
}

function makeController(
  overrides: {
    pairsService?: Partial<PairsService>;
    botService?: Partial<BotService>;
    accountService?: Partial<AccountService>;
    analyticsService?: Partial<BotAnalyticsService>;
  } = {},
) {
  const pairsService = {
    getUserPairs: jest.fn().mockResolvedValue([]),
    createPairInvite: jest.fn().mockResolvedValue('ABCDE'),
    joinPair: jest.fn().mockResolvedValue(true),
    leavePair: jest.fn().mockResolvedValue(undefined),
    ...overrides.pairsService,
  } as unknown as PairsService;
  const botService = {
    getRatings: jest.fn().mockResolvedValue({}),
    ...overrides.botService,
  } as unknown as BotService;
  const accountService = {
    getUserFirstName: jest.fn().mockResolvedValue('Партнёр'),
    ...overrides.accountService,
  } as unknown as AccountService;
  const analyticsService = {
    getHistoryRatings: jest.fn().mockResolvedValue([]),
    ...overrides.analyticsService,
  } as unknown as BotAnalyticsService;
  const controller = new PairsController(
    pairsService,
    accountService,
    botService,
    analyticsService,
  );
  return {
    controller,
    pairsService,
    botService,
    accountService,
    analyticsService,
  };
}

describe('PairsController.getPair', () => {
  it('без пар — пустой список партнёров, pendingCode: null', async () => {
    const { controller } = makeController();
    await expect(controller.getPair(makeReq())).resolves.toEqual({
      partners: [],
      pendingCode: null,
    });
  });

  it('только pending-пара, созданная юзером — попадает в pendingCode', async () => {
    const { controller } = makeController({
      pairsService: {
        getUserPairs: jest.fn().mockResolvedValue([
          {
            code: 'WAIT1',
            status: 'pending',
            isCreator: true,
            partnerId: null,
          },
        ]),
      },
    });
    const res = await controller.getPair(makeReq());
    expect(res).toEqual({ partners: [], pendingCode: 'WAIT1' });
  });

  it('партнёр оценил не все потребности сегодня → partnerTodayDone: false, partnerIndex: null', async () => {
    const { controller } = makeController({
      pairsService: {
        getUserPairs: jest
          .fn()
          .mockResolvedValue([
            { code: 'AB', status: 'active', isCreator: true, partnerId: 42 },
          ]),
      },
      botService: {
        getRatings: jest.fn().mockResolvedValue({ attachment: 8 }), // не все
      },
    });
    const res = await controller.getPair(makeReq());
    expect(res.partners[0].partnerTodayDone).toBe(false);
    expect(res.partners[0].partnerIndex).toBeNull();
  });

  it('партнёр оценил всё — partnerIndex — среднее по всем потребностям (округлено до 0.1)', async () => {
    const { controller } = makeController({
      pairsService: {
        getUserPairs: jest
          .fn()
          .mockResolvedValue([
            { code: 'AB', status: 'active', isCreator: true, partnerId: 42 },
          ]),
      },
      botService: { getRatings: jest.fn().mockResolvedValue(allNeedsRated(7)) },
    });
    const res = await controller.getPair(makeReq());
    expect(res.partners[0].partnerTodayDone).toBe(true);
    expect(res.partners[0].partnerIndex).toBe(7);
    expect(res.partners[0].partnerName).toBe('Партнёр');
    expect(res.partners[0].partnerTelegramId).toBe(42);
  });

  it('запрашивает данные ИМЕННО partnerId, а не userId текущего юзера', async () => {
    const { controller, botService, accountService, analyticsService } =
      makeController({
        pairsService: {
          getUserPairs: jest
            .fn()
            .mockResolvedValue([
              { code: 'AB', status: 'active', isCreator: true, partnerId: 555 },
            ]),
        },
      });
    await controller.getPair(makeReq(1n));
    expect(botService.getRatings).toHaveBeenCalledWith(555n);
    expect(accountService.getUserFirstName).toHaveBeenCalledWith(555n);
    expect(analyticsService.getHistoryRatings).toHaveBeenCalledWith(555n, 7);
  });

  it('partnerWeekAvgs: день без полной истории — null, а не 0/NaN', async () => {
    const today = new Date().toISOString().split('T')[0];
    const { controller } = makeController({
      pairsService: {
        getUserPairs: jest
          .fn()
          .mockResolvedValue([
            { code: 'AB', status: 'active', isCreator: true, partnerId: 1 },
          ]),
      },
      analyticsService: {
        getHistoryRatings: jest
          .fn()
          .mockResolvedValue([{ date: today, ratings: { attachment: 5 } }]), // неполный день
      },
    });
    const res = await controller.getPair(makeReq());
    expect(res.partners[0].partnerWeekAvgs[0]).toBeNull();
  });
});

describe('PairsController.createPairInvite', () => {
  it('создаёт инвайт под userId из req, возвращает ссылку с кодом', async () => {
    const { controller, pairsService } = makeController();
    const res = await controller.createPairInvite(makeReq(9n));
    expect(pairsService.createPairInvite).toHaveBeenCalledWith(9n);
    expect(res.code).toBe('ABCDE');
    expect(res.url).toContain('ABCDE');
  });
});

describe('PairsController.joinPair', () => {
  it('невалидный формат кода → BadRequestException, join не вызывается', async () => {
    const { controller, pairsService } = makeController();
    await expect(
      controller.joinPair(makeReq(), { code: 'ab' }), // слишком короткий
    ).rejects.toThrow(BadRequestException);
    expect(pairsService.joinPair).not.toHaveBeenCalled();
  });

  it('код приводится к верхнему регистру перед передачей в сервис', async () => {
    const { controller, pairsService } = makeController();
    await controller.joinPair(makeReq(3n), { code: 'abcde' });
    expect(pairsService.joinPair).toHaveBeenCalledWith(3n, 'ABCDE');
  });

  it('сервис вернул false (код невалиден/истёк) → BadRequestException', async () => {
    const { controller } = makeController({
      pairsService: { joinPair: jest.fn().mockResolvedValue(false) },
    });
    await expect(
      controller.joinPair(makeReq(), { code: 'ABCDE' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('PairsController.leavePair', () => {
  it('без кода → BadRequestException', async () => {
    const { controller, pairsService } = makeController();
    await expect(controller.leavePair(makeReq(), { code: '' })).rejects.toThrow(
      BadRequestException,
    );
    expect(pairsService.leavePair).not.toHaveBeenCalled();
  });

  it('уходит из пары под userId из req', async () => {
    const { controller, pairsService } = makeController();
    await controller.leavePair(makeReq(4n), { code: 'ABCDE' });
    expect(pairsService.leavePair).toHaveBeenCalledWith(4n, 'ABCDE');
  });
});
