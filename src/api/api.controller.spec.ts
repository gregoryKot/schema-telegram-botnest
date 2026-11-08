// Мелкие эндпоинты api.controller.ts: typed UI-флаги, профиль, disclaimer.
// Прямой потребитель PrismaService — фейкуем таблицу user (см.
// test-support/fake-prisma.spec-helper.ts), остальное — фейковые сервисы.
// Приоритет: userId ВСЕГДА из req.webUser (не из body — попытка подсунуть
// чужой userId/id в теле игнорируется).
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ApiController } from './api.controller';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';
import type { BotService } from '../bot/bot.service';
import type { AccountService } from '../bot/account.service';
import type { ProfileService } from '../bot/profile.service';
import type { TelegramScheduleService } from '../telegram/telegram.schedule.service';

function makeReq(userId = 1n, extra: Record<string, unknown> = {}) {
  return { webUser: { userId }, ...extra } as any;
}

function makeController(
  overrides: {
    botService?: Partial<BotService>;
    accountService?: Partial<AccountService>;
    profileService?: Partial<ProfileService>;
    scheduleService?: Partial<TelegramScheduleService>;
    userRows?: Record<string, unknown>[];
  } = {},
) {
  const botService = {
    hasAcceptedDisclaimer: jest.fn().mockResolvedValue(false),
    acceptDisclaimer: jest.fn().mockResolvedValue(undefined),
    ...overrides.botService,
  } as unknown as BotService;
  const accountService = {
    updateName: jest.fn().mockResolvedValue(undefined),
    registerUser: jest.fn().mockResolvedValue(undefined),
    deleteAllUserData: jest.fn().mockResolvedValue(undefined),
    ...overrides.accountService,
  } as unknown as AccountService;
  const profileService = {
    getProfile: jest.fn().mockResolvedValue({ name: 'Юзер' }),
    ...overrides.profileService,
  } as unknown as ProfileService;
  const scheduleService = {
    rescheduleForUser: jest.fn().mockResolvedValue(undefined),
    ...overrides.scheduleService,
  } as unknown as TelegramScheduleService;
  const userTable = createFakeTable(overrides.userRows ?? []);
  const prisma = { user: userTable } as any;
  const controller = new ApiController(
    botService,
    accountService,
    profileService,
    prisma,
    scheduleService,
  );
  return {
    controller,
    scheduleService,
    botService,
    accountService,
    profileService,
    userTable,
  };
}

describe('ApiController user-flags', () => {
  it('GET на пустом аккаунте (нет строки) → {}', async () => {
    const { controller } = makeController();
    await expect(controller.getUserFlags(makeReq())).resolves.toEqual({});
  });

  it('GET возвращает флаги существующей строки под userId из req', async () => {
    const { controller } = makeController({
      userRows: [{ id: 5n, themePref: 'dark', onboardingV1Done: true }],
    });
    const res = await controller.getUserFlags(makeReq(5n));
    expect(res).toEqual(
      expect.objectContaining({ themePref: 'dark', onboardingV1Done: true }),
    );
  });
});

/** «МЕТОД путь» каждой ручки контроллера — из метаданных Nest. */
function routesOf(ctrl: { prototype: object }): string[] {
  const proto = ctrl.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto).flatMap((name) => {
    const handler = proto[name];
    if (typeof handler !== 'function') return [];
    const path: unknown = Reflect.getMetadata(PATH_METADATA, handler);
    const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
    if (typeof path !== 'string' || typeof method !== 'number') return [];
    return [`${RequestMethod[method]} ${path}`];
  });
}

describe('ApiController — мёртвых ручек нет', () => {
  // GET/POST/DELETE /api/drafts* не звал ни один фронт: черновики живут в
  // localStorage (shared/src/utils/drafts.ts). Таблица DiaryDraft осталась
  // (строки на проде удаляет решение владельца) — её чистят удаление
  // аккаунта и слияние по реестрам USER_DATA_TABLES / USER_OWNED_TABLES.
  // POST /api/user-flags писал только удалённый мини-апп (#908); GET жив —
  // его зовёт сайт (shared/src/api/sharedApi.ts, getUserFlags → therapistMode).
  it('POST /api/user-flags нет, GET остаётся', () => {
    const routes = routesOf(ApiController);
    expect(routes).toContain('GET user-flags');
    expect(routes).not.toContain('POST user-flags');
  });

  it('ручек черновиков /api/drafts нет', () => {
    expect(routesOf(ApiController).filter((r) => r.includes('drafts'))).toEqual(
      [],
    );
  });
});

describe('ApiController profile / name / init / disclaimer', () => {
  it('getProfile делегирует с userId из req', async () => {
    const { controller, profileService } = makeController();
    await controller.getProfile(makeReq(6n));
    expect(profileService.getProfile).toHaveBeenCalledWith(6n);
  });

  it('updateName: пустое имя (после trim) → BadRequestException', async () => {
    const { controller, accountService } = makeController();
    await expect(
      controller.updateName(makeReq(), { name: '   ' }),
    ).rejects.toThrow(BadRequestException);
    expect(accountService.updateName).not.toHaveBeenCalled();
  });

  it('updateName: имя длиннее 50 символов → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.updateName(makeReq(), { name: 'x'.repeat(51) }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateName: тримит имя, сохраняет под userId из req', async () => {
    const { controller, accountService } = makeController();
    await controller.updateName(makeReq(9n), {
      name: '  Марина  ',
    });
    expect(accountService.updateName).toHaveBeenCalledWith(9n, 'Марина');
  });

  it('init: регистрирует юзера с firstName из req и timezone из body', async () => {
    const { controller, accountService } = makeController();
    await controller.init(makeReq(2n, { telegramFirstName: 'Олег' }), {
      timezone: 'Europe/Moscow',
    });
    expect(accountService.registerUser).toHaveBeenCalledWith(
      2n,
      'Олег',
      'Europe/Moscow',
    );
  });

  it('init: пояс устройства сменил пояс уведомлений → напоминание перепланируется', async () => {
    const { controller, scheduleService } = makeController({
      accountService: { registerUser: jest.fn().mockResolvedValue(true) },
    });
    await controller.init(makeReq(2n), { timezone: 'Asia/Vladivostok' });
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(2n);
  });

  it('init: пояс не сменился — расписание не трогается; сбой перепланирования init не роняет', async () => {
    const same = makeController({
      accountService: { registerUser: jest.fn().mockResolvedValue(false) },
    });
    await same.controller.init(makeReq(2n), { timezone: 'Europe/Moscow' });
    expect(same.scheduleService.rescheduleForUser).not.toHaveBeenCalled();

    const failing = makeController({
      accountService: { registerUser: jest.fn().mockResolvedValue(true) },
      scheduleService: {
        rescheduleForUser: jest.fn().mockRejectedValue(new Error('queue down')),
      },
    });
    await expect(
      failing.controller.init(makeReq(2n), { timezone: 'Asia/Omsk' }),
    ).resolves.toEqual({ ok: true });
  });

  it('disclaimer GET/POST делегируют с userId из req', async () => {
    const { controller, botService } = makeController({
      botService: { hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true) },
    });
    await expect(controller.getDisclaimer(makeReq(3n))).resolves.toEqual({
      accepted: true,
    });
    expect(botService.hasAcceptedDisclaimer).toHaveBeenCalledWith(3n);

    await controller.acceptDisclaimer(makeReq(3n));
    // Экран согласий кабинета закрывает и онбординг (метрика /stats).
    expect(botService.acceptDisclaimer).toHaveBeenCalledWith(3n, true);
  });
});
