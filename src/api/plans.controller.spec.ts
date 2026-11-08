// Практики и планы: needId валидируется по NEED_IDS (иначе можно
// протащить произвольный ключ, ломающий агрегации по потребности),
// days зажимается сверху (365 — граница «Мой путь»), локальная дата
// считается в таймзоне юзера (не UTC-датой сервера — иначе «завтра»
// у юзера в UTC+11 может стать «сегодня» на сервере).
import { BadRequestException } from '@nestjs/common';
import { PlansController } from './plans.controller';
import type { BotService } from '../bot/bot.service';
import type { PracticesService } from '../bot/practices.service';
import type { NotificationService } from '../notification/notification.service';

function makeReq(userId = 1n) {
  return { webUser: { userId } } as any;
}

function makeController(
  overrides: {
    botService?: Partial<BotService>;
    practicesService?: Partial<PracticesService>;
    notificationService?: Partial<NotificationService>;
  } = {},
) {
  const botService = {
    getUserSettings: jest
      .fn()
      .mockResolvedValue({ notifyTimezone: 'Europe/Moscow' }),
    ...overrides.botService,
  } as unknown as BotService;
  const practicesService = {
    getPractices: jest.fn().mockResolvedValue([]),
    addPractice: jest.fn().mockResolvedValue({ id: 1 }),
    deletePractice: jest.fn().mockResolvedValue(undefined),
    getPendingPlans: jest.fn().mockResolvedValue([]),
    createPlan: jest.fn().mockResolvedValue({ id: 2 }),
    checkinPlan: jest.fn().mockResolvedValue(undefined),
    getPlanHistory: jest.fn().mockResolvedValue([]),
    ...overrides.practicesService,
  } as unknown as PracticesService;
  const notificationService = {
    schedule: jest.fn().mockResolvedValue(undefined),
    ...overrides.notificationService,
  } as unknown as NotificationService;
  const controller = new PlansController(
    botService,
    practicesService,
    notificationService,
  );
  return { controller, botService, practicesService, notificationService };
}

describe('PlansController.getPractices', () => {
  it('невалидный needId → BadRequestException', async () => {
    const { controller, practicesService } = makeController();
    await expect(
      controller.getPractices(makeReq(), 'not_a_need'),
    ).rejects.toThrow(BadRequestException);
    expect(practicesService.getPractices).not.toHaveBeenCalled();
  });

  it('валидный needId делегируется с userId из req', async () => {
    const { controller, practicesService } = makeController();
    await controller.getPractices(makeReq(5n), 'attachment');
    expect(practicesService.getPractices).toHaveBeenCalledWith(
      5n,
      'attachment',
    );
  });
});

describe('PlansController.addPractice', () => {
  it('чистит пробелы по краям, не режет хвост (лимит — в DTO), сохраняет под userId из req', async () => {
    const { controller, practicesService } = makeController();
    await controller.addPractice(makeReq(3n), {
      needId: 'attachment',
      text: '  ' + 'x'.repeat(200) + '  ',
    });
    const [userId, needId, text] = (practicesService.addPractice as jest.Mock)
      .mock.calls[0];
    expect(userId).toBe(3n);
    expect(needId).toBe('attachment');
    expect(text).toBe('x'.repeat(200));
  });
});

describe('PlansController.deletePractice', () => {
  it('parseId валидирует id перед вызовом сервиса', async () => {
    const { controller, practicesService } = makeController();
    await expect(controller.deletePractice(makeReq(), 'abc')).rejects.toThrow(
      BadRequestException,
    );
    expect(practicesService.deletePractice).not.toHaveBeenCalled();
  });
});

describe('PlansController.getPendingPlans', () => {
  it('берёт таймзону из настроек юзера, дефолт — Europe/Moscow', async () => {
    const { controller, botService, practicesService } = makeController({
      botService: { getUserSettings: jest.fn().mockResolvedValue(null) },
    });
    await controller.getPendingPlans(makeReq(2n));
    expect(botService.getUserSettings).toHaveBeenCalledWith(2n);
    expect(practicesService.getPendingPlans).toHaveBeenCalledWith(
      2n,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });
});

describe('PlansController.createPlan', () => {
  it('без reminderUtcHour — уведомление не планируется', async () => {
    const { controller, notificationService, practicesService } =
      makeController();
    await controller.createPlan(makeReq(4n), {
      needId: 'attachment',
      practiceText: 'практика',
    });
    expect(practicesService.createPlan).toHaveBeenCalledWith(
      4n,
      'attachment',
      'практика',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      undefined,
    );
    expect(notificationService.schedule).not.toHaveBeenCalled();
  });

  it('с reminderUtcHour — планирует уведомление с текстом практики и planId', async () => {
    const { controller, notificationService } = makeController({
      practicesService: {
        createPlan: jest.fn().mockResolvedValue({ id: 77 }),
      },
    });
    await controller.createPlan(makeReq(4n), {
      needId: 'attachment',
      practiceText: '  практика  ',
      reminderUtcHour: 9,
    });
    expect(notificationService.schedule).toHaveBeenCalledWith(
      4n,
      'practice_reminder',
      expect.any(Date),
      { practiceText: 'практика', needId: 'attachment', planId: 77 },
    );
  });
});

// E11 аудита 2026-11: момент напоминания — стенные часы дня плана в поясе
// человека. До починки момент брался от UTC-даты сервера: Москва в 00:30 —
// на день раньше, Владивосток «Утром» и Нью-Йорк вечером — на день позже.
describe('PlansController.createPlan — напоминание в день плана по поясу человека', () => {
  afterEach(() => jest.useRealTimers());

  const plan = (tz: string, now: string, hour: Record<string, number>) => {
    jest.useFakeTimers({ now: new Date(now) });
    const ctx = makeController({
      botService: {
        getUserSettings: jest.fn().mockResolvedValue({ notifyTimezone: tz }),
      },
    });
    const body = { needId: 'attachment', practiceText: 'практика', ...hour };
    return ctx.controller.createPlan(makeReq(4n), body).then(() => ctx);
  };
  const sentAt = (n: NotificationService) =>
    ((n.schedule as jest.Mock).mock.calls[0][2] as Date).toISOString();

  it.each([
    // 00:30 по Москве 8-го: план на 9-е, «Утром» — 9-го в 09:00 МСК
    ['Europe/Moscow', '2026-11-07T21:30:00Z', '2026-11-09T06:00:00.000Z', 6],
    // 20:00 во Владивостоке 8-го: 9:00 9-го — это 23:00 UTC 8-го
    [
      'Asia/Vladivostok',
      '2026-11-08T10:00:00Z',
      '2026-11-08T23:00:00.000Z',
      23,
    ],
    // 22:00 в Нью-Йорке 8-го (в UTC уже 9-е): план на 9-е
    [
      'America/New_York',
      '2026-11-09T03:00:00Z',
      '2026-11-09T14:00:00.000Z',
      14,
    ],
  ])('%s, сейчас %s: местный час 9 → %s', async (tz, now, at, utcHour) => {
    const { notificationService, practicesService } = await plan(tz, now, {
      reminderLocalHour: 9,
    });
    expect(sentAt(notificationService)).toBe(at);
    // В плане — завтрашний день человека (9-е) и час UTC настоящего момента.
    expect(practicesService.createPlan).toHaveBeenCalledWith(
      4n,
      'attachment',
      'практика',
      '2026-11-09',
      utcHour,
    );
  });

  it.each([
    ['Europe/Moscow', '2026-11-07T21:30:00Z', 6, '2026-11-09T06:00:00.000Z'],
    [
      'Asia/Vladivostok',
      '2026-11-08T10:00:00Z',
      23,
      '2026-11-08T23:00:00.000Z',
    ],
    [
      'America/New_York',
      '2026-11-09T03:00:00Z',
      14,
      '2026-11-09T14:00:00.000Z',
    ],
  ])(
    'старый клиент (%s, час UTC %i) — тоже день плана',
    async (tz, now, h, at) => {
      const { notificationService } = await plan(tz, now, {
        reminderUtcHour: h,
      });
      expect(sentAt(notificationService)).toBe(at);
    },
  );

  it('пришли оба часа — главный местный', async () => {
    const { notificationService } = await plan(
      'Europe/Moscow',
      '2026-11-07T21:30:00Z',
      { reminderLocalHour: 19, reminderUtcHour: 6 },
    );
    expect(sentAt(notificationService)).toBe('2026-11-09T16:00:00.000Z');
  });
});

describe('PlansController.checkinPlan', () => {
  it('передаёт done и userId из req, id — из path через parseId', async () => {
    const { controller, practicesService } = makeController();
    await controller.checkinPlan(makeReq(6n), '12', { done: true });
    expect(practicesService.checkinPlan).toHaveBeenCalledWith(6n, 12, true);
  });
});

describe('PlansController.getPlanHistory', () => {
  it('без days — дефолт 30', async () => {
    const { controller, practicesService } = makeController();
    await controller.getPlanHistory(makeReq(1n));
    expect(practicesService.getPlanHistory).toHaveBeenCalledWith(1n, 30);
  });

  it('days зажимается сверху в 365', async () => {
    const { controller, practicesService } = makeController();
    await controller.getPlanHistory(makeReq(1n), '9999');
    expect(practicesService.getPlanHistory).toHaveBeenCalledWith(1n, 365);
  });

  it('нечисловое days трактуется как дефолт (30)', async () => {
    const { controller, practicesService } = makeController();
    await controller.getPlanHistory(makeReq(1n), 'garbage');
    expect(practicesService.getPlanHistory).toHaveBeenCalledWith(1n, 30);
  });
});
