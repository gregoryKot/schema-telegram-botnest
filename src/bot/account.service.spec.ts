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
    'userLetter',
    'userSafePlace',
    'userFlashcard',
    'userPractice',
    'practicePlan',
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
