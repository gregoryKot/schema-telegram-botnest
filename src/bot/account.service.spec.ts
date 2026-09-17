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
