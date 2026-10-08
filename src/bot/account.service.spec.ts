// Регрессия на находку аудита 2026-07 (D-1): deleteAllUserData чистил
// ClientConceptualization и TherapistNote только по therapistId. Когда аккаунт
// удалял КЛИЕНТ, клинические записи о нём (schemaIds, unmetNeeds, triggers,
// заметки) оставались в БД навсегда — нарушение right-to-erasure.
// Тест фиксирует: обе таблицы чистятся по OR [{therapistId}, {clientId}].
import { AccountService } from './account.service';

function makePrisma() {
  const calls: Record<string, any[]> = {};
  const deleteMany = (table: string) =>
    jest.fn(async (args: any) => {
      (calls[table] ??= []).push(args);
      return { count: 0 };
    });

  const tables = [
    // USER_DATA_TABLES
    'rating',
    'note',
    'userSchemaNote',
    'userModeNote',
    'userBeliefCheck',
    'userPhraseCheck',
    'userLetter',
    'userSafePlace',
    'userFlashcard',
    'userPractice',
    'practicePlan',
    'practiceSession',
    'childhoodRating',
    'ysqResult',
    'ysqProgress',
    'ysqResultHistory',
    'scheduledNotification',
    'schemaDiaryEntry',
    'modeDiaryEntry',
    'gratitudeDiaryEntry',
    'appActivity',
    'userTask',
    'diaryDraft',
    'emailToken',
    'analyticsEvent',
    'loginTicket',
    // отдельно обрабатываемые
    'clientConceptualization',
    'therapistNote',
    'therapyRelation',
    'modeMap',
    'therapistCustomMode',
    'pair',
    'authProvider',
    'webSession',
    'therapistRequest',
    'subscription',
  ];

  const prisma: any = {
    $transaction: jest.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
    $executeRawUnsafe: jest.fn(() => Promise.resolve(0)),
    user: { delete: jest.fn(async () => ({})) },
    booking: {
      updateMany: jest.fn(async (args: any) => {
        (calls['booking'] ??= []).push(args);
        return { count: 0 };
      }),
    },
    _calls: calls,
  };
  for (const t of tables) prisma[t] = { deleteMany: deleteMany(t) };
  // Адрес в Telegram спрашивают перед удалением подписки: она привязана к
  // telegramId, а не к userId, и после слияния аккаунтов эти номера разные.
  prisma.authProvider.findFirst = jest.fn(async () => null);
  return prisma;
}

describe('AccountService.deleteAllUserData — right-to-erasure', () => {
  const uid = 12345n;

  it('чистит клинические записи О пользователе (clientId), а не только ЕГО записи как терапевта', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);
    await service.deleteAllUserData(uid);

    for (const table of ['clientConceptualization', 'therapistNote']) {
      const args = prisma._calls[table]?.[0];
      expect(args).toBeDefined();
      // Ключевой инвариант: where покрывает ОБЕ роли пользователя.
      expect(args.where).toEqual({
        OR: [{ therapistId: uid }, { clientId: uid }],
      });
    }
  });

  // Аудит 2026-10, T8: задания офлайн-клиентов терапевта (userId < 0, FK нет)
  // оставались сиротами после удаления терапевта.
  it('удаляет задания терапевта виртуальным клиентам (userId < 0), не трогая задания реальных', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);
    await service.deleteAllUserData(uid);

    const wheres = prisma._calls['userTask'].map((a: any) => a.where);
    expect(wheres).toContainEqual({ assignedBy: uid, userId: { lt: 0n } });
    // Условие узкое: только отрицательные userId — задачи, назначенные реальным
    // клиентам, принадлежат им и этим запросом не сносятся.
    expect(wheres).not.toContainEqual({ assignedBy: uid });
  });

  // Аудит 2026-10, F3: записи на консультацию не удаляются (деньги, календарь),
  // но привязка к Telegram-id обнуляется.
  it('обнуляет Booking.clientTelegramId по адресу в Telegram, не удаляя записи', async () => {
    const prisma = makePrisma();
    prisma.authProvider.findFirst = jest.fn(async () => ({
      providerId: '777000',
    }));
    const service = new AccountService(prisma);
    await service.deleteAllUserData(uid);

    const [args] = prisma._calls['booking'];
    expect(args.data).toEqual({ clientTelegramId: null });
    // и веб-id, и Telegram-id аккаунта (после слияния это разные числа)
    expect(args.where.clientTelegramId.in).toEqual(
      expect.arrayContaining([uid, 777000n]),
    );
  });

  // Находка L3 аудита 2026-07-20, пункт «ещё модели мимо реестров»: у билета
  // входа человек стоит в двух колонках помимо userId — shownToTelegramId
  // (сырой адрес в Telegram, кому бот показал карточку сверки) и
  // approvedUserId (кто подтвердил). Реестр USER_DATA_TABLES чистит LoginTicket
  // только по userId, и эти две оси оставались.
  it('чистит билеты входа и по shownToTelegramId, и по approvedUserId', async () => {
    const prisma = makePrisma();
    prisma.authProvider.findFirst = jest.fn(async () => ({
      providerId: '777000',
    }));
    const service = new AccountService(prisma);
    await service.deleteAllUserData(uid);

    const wheres = prisma._calls['loginTicket'].map((a: any) => a.where);
    // Первый вызов — из реестра, по userId; второй — по двум вторичным осям.
    expect(wheres).toContainEqual({ userId: uid });
    const secondary = wheres.find((w: any) => Array.isArray(w.OR));
    expect(secondary.OR).toEqual([
      { shownToTelegramId: { in: expect.arrayContaining([uid, 777000n]) } },
      { approvedUserId: uid },
    ]);
  });

  it('удаляет саму строку User и все user-owned таблицы в одной транзакции', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);
    await service.deleteAllUserData(uid);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: uid } });
    // Выборочно: типовая user-owned таблица чистится по userId.
    expect(prisma._calls['rating'][0].where).toEqual({ userId: uid });
    expect(prisma._calls['webSession'][0].where).toEqual({ userId: uid });
  });
});

describe('AccountService — режим/роль терапевта', () => {
  const uid = 777n;

  it('setTherapistMode пишет therapistMode в User', async () => {
    const update = jest.fn(() => Promise.resolve({}));
    const prisma = { user: { update } } as never;
    const service = new AccountService(prisma);

    await service.setTherapistMode(uid, false);
    expect(update).toHaveBeenCalledWith({
      where: { id: uid },
      data: { therapistMode: false },
    });
  });

  it('resignTherapist: CLIENT + therapistMode=false + удаление заявки, всё в одной транзакции', async () => {
    const userUpdate = jest.fn(() => Promise.resolve({}));
    const reqDeleteMany = jest.fn(() => Promise.resolve({ count: 1 }));
    const tx = {
      user: { update: userUpdate },
      therapistRequest: { deleteMany: reqDeleteMany },
    };
    const transaction = jest.fn((fn: (t: typeof tx) => unknown) => fn(tx));
    const prisma = { $transaction: transaction } as never;
    const service = new AccountService(prisma);

    await service.resignTherapist(uid);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: uid },
      data: { role: 'CLIENT', therapistMode: false },
    });
    // Заявка удаляется, иначе status 'approved' заблокирует повторную подачу.
    expect(reqDeleteMany).toHaveBeenCalledWith({ where: { userId: uid } });
  });
});

// Разбор 2026-08-29. Подписка привязана к telegramId, а не к userId, и до
// правки удалялась запросом `telegramId: userId` с пояснением «у
// телеграм-пользователей это одно и то же». После слияния аккаунтов это
// перестаёт быть правдой: удаление веб-аккаунта не отменяло подписку, и
// списания продолжались с человека, который аккаунт удалил.
describe('deleteAllUserData — подписка ищется по адресу в Telegram', () => {
  it('слитый аккаунт: снимает подписку по telegramId из привязки', async () => {
    const prisma = makePrisma();
    (prisma.authProvider.findFirst as jest.Mock).mockResolvedValue({
      providerId: '42',
    });
    const service = new AccountService(prisma);

    await service.deleteAllUserData(1_000_000_000_000_777n);

    const args = prisma._calls['subscription']?.[0];
    expect(args.where.telegramId.in).toContain(42n);
  });

  it('без привязки ищет по самому номеру — старый пользователь бота', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.deleteAllUserData(12345n);

    const args = prisma._calls['subscription']?.[0];
    expect(args.where.telegramId.in).toEqual([12345n]);
  });
});
