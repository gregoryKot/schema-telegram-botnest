// Мелкие эндпоинты api.controller.ts: link-token, typed UI-флаги, черновики
// дневника (диревики), профиль, disclaimer, удаление аккаунта. Прямой
// потребитель PrismaService — фейкуем таблицы user/diaryDraft (см.
// test-support/fake-prisma.spec-helper.ts), остальное — фейковые сервисы.
// Приоритет: userId ВСЕГДА из req.webUser (не из body — попытка подсунуть
// чужой userId/id в теле игнорируется), и therapistMode нельзя выставить
// клиентом через user-flags (это привилегия, производная от role).
import { BadRequestException } from '@nestjs/common';
import { ApiController } from './api.controller';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';
import type { BotService } from '../bot/bot.service';
import type { AccountService } from '../bot/account.service';
import type { ProfileService } from '../bot/profile.service';
import type { AuthService } from '../auth/auth.service';

function makeReq(userId = 1n, extra: Record<string, unknown> = {}) {
  return { webUser: { userId }, ...extra } as any;
}

function makeRes() {
  return { cookie: jest.fn() } as any;
}

function makeController(
  overrides: {
    botService?: Partial<BotService>;
    accountService?: Partial<AccountService>;
    profileService?: Partial<ProfileService>;
    authService?: Partial<AuthService>;
    userRows?: Record<string, unknown>[];
    draftRows?: Record<string, unknown>[];
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
  const authService = {
    buildLinkToken: jest.fn().mockReturnValue('link-token-abc'),
    ...overrides.authService,
  } as unknown as AuthService;
  const userTable = createFakeTable(overrides.userRows ?? []);
  const draftTable = createFakeTable(overrides.draftRows ?? [], {
    idField: 'id',
  });
  const prisma = { user: userTable, diaryDraft: draftTable } as any;
  const controller = new ApiController(
    botService,
    accountService,
    profileService,
    prisma,
    authService,
  );
  return {
    controller,
    botService,
    accountService,
    profileService,
    authService,
    userTable,
    draftTable,
  };
}

describe('ApiController.issueLinkToken', () => {
  it('выпускает токен под userId из req, ставит httpOnly-cookie с TTL 60с', () => {
    const { controller, authService } = makeController();
    const res = makeRes();
    const result = controller.issueLinkToken(makeReq(5n), res);

    expect(authService.buildLinkToken).toHaveBeenCalledWith(5n);
    expect(result).toEqual({ linkToken: 'link-token-abc', expiresIn: 60 });
    expect(res.cookie).toHaveBeenCalledWith(
      'link_token',
      'link-token-abc',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        maxAge: 60_000,
        path: '/api/auth',
      }),
    );
  });
});

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

  it('POST с телом не-объектом → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.setUserFlags(makeReq(), null as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('POST с пустым пересечением полей → ok без записи в БД', async () => {
    const { controller, userTable } = makeController({
      userRows: [{ id: 1n }],
    });
    const res = await controller.setUserFlags(makeReq(), { unknownField: 1 });
    expect(res).toEqual({ ok: true });
    expect(userTable.update).not.toHaveBeenCalled();
  });

  it('therapistMode НЕ входит в список писабельных полей (привилегия, не флаг)', async () => {
    const { controller, userTable } = makeController({
      userRows: [{ id: 1n }],
    });
    const res = await controller.setUserFlags(makeReq(), {
      therapistMode: true,
    });
    // Ручка отвечает успехом (клиент не должен ретраить), но привилегия не
    // выдана: therapistMode не в FLAG_FIELDS → data пуст → update не зовётся.
    expect(res).toEqual({ ok: true });
    expect(userTable.update).not.toHaveBeenCalled();
  });

  it('POST сохраняет только известные поля под userId из req, чужой userId в body игнорируется', async () => {
    const { controller, userTable } = makeController({
      userRows: [{ id: 3n }],
    });
    await controller.setUserFlags(makeReq(3n), {
      themePref: 'dark',
      onboardingV1Done: true,
      therapistMode: true, // должен быть отфильтрован
      userId: 999, // должен быть проигнорирован
    });
    expect(userTable.update).toHaveBeenCalledWith({
      where: { id: 3n },
      data: { themePref: 'dark', onboardingV1Done: true },
    });
  });
});

describe('ApiController drafts', () => {
  it('POST невалидный type → BadRequestException', async () => {
    const { controller, draftTable } = makeController();
    await expect(
      controller.saveDraft(makeReq(), 'unknown', {
        startedAt: '2026-07-17T10:00:00.000Z',
        data: {},
      }),
    ).rejects.toThrow(BadRequestException);
    expect(draftTable.upsert).not.toHaveBeenCalled();
  });

  it('POST без startedAt → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.saveDraft(makeReq(), 'schema', { data: {} } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('POST неверный формат startedAt (не ISO с Z) → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.saveDraft(makeReq(), 'schema', {
        startedAt: '17.07.2026',
        data: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('POST синтаксически валидная, но невозможная дата → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(
      controller.saveDraft(makeReq(), 'schema', {
        startedAt: '2026-99-99T00:00:00.000Z',
        data: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('POST валидный черновик сохраняется под userId из req (не из body)', async () => {
    const { controller, draftTable } = makeController();
    await controller.saveDraft(makeReq(7n), 'gratitude', {
      startedAt: '2026-07-17T10:00:00.000Z',
      data: { text: 'привет' },
      userId: 999,
    } as any);
    expect(draftTable.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_type: { userId: 7n, type: 'gratitude' } },
        create: expect.objectContaining({ userId: 7n, type: 'gratitude' }),
      }),
    );
  });

  it('GET читает черновики только текущего userId и разбирает JSON-данные обратно', async () => {
    const now = new Date('2026-07-17T10:00:00.000Z');
    const { controller } = makeController({
      draftRows: [
        {
          id: 1,
          userId: 1n,
          type: 'schema',
          startedAt: now,
          data: JSON.stringify({ text: 'мой черновик' }),
        },
        {
          id: 2,
          userId: 2n, // чужой юзер — не должен попасть в ответ
          type: 'mode',
          startedAt: now,
          data: JSON.stringify({ text: 'чужой' }),
        },
      ],
    });
    const res = await controller.getDrafts(makeReq(1n));
    expect(Object.keys(res)).toEqual(['schema']);
    expect(res.schema.startedAt).toBe('2026-07-17T10:00:00.000Z');
    expect(res.schema.data).toEqual({ text: 'мой черновик' });
  });

  it('GET: легаси-строки хранят объект как есть (не строка) — пропускается без парсинга', async () => {
    const now = new Date();
    const { controller } = makeController({
      draftRows: [
        { id: 1, userId: 1n, type: 'mode', startedAt: now, data: { a: 1 } },
      ],
    });
    const res = await controller.getDrafts(makeReq(1n));
    expect(res.mode.data).toEqual({ a: 1 });
  });

  it('DELETE невалидный type → BadRequestException', async () => {
    const { controller } = makeController();
    await expect(controller.deleteDraft(makeReq(), 'nope')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('DELETE удаляет черновик только текущего userId', async () => {
    const { controller, draftTable } = makeController();
    await controller.deleteDraft(makeReq(4n), 'schema');
    expect(draftTable.deleteMany).toHaveBeenCalledWith({
      where: { userId: 4n, type: 'schema' },
    });
  });
});

describe('ApiController profile / name / init / disclaimer / deleteUser', () => {
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

  it('disclaimer GET/POST делегируют с userId из req', async () => {
    const { controller, botService } = makeController({
      botService: { hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true) },
    });
    await expect(controller.getDisclaimer(makeReq(3n))).resolves.toEqual({
      accepted: true,
    });
    expect(botService.hasAcceptedDisclaimer).toHaveBeenCalledWith(3n);

    await controller.acceptDisclaimer(makeReq(3n));
    expect(botService.acceptDisclaimer).toHaveBeenCalledWith(3n);
  });

  it('deleteUser удаляет данные ИМЕННО текущего userId (не константу/чужой id)', async () => {
    const { controller, accountService } = makeController();
    await controller.deleteUser(makeReq(11n));
    expect(accountService.deleteAllUserData).toHaveBeenCalledWith(11n);
  });
});
