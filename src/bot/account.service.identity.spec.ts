// Волна В mutation-покрытия (2026-08): registerUser/роль/блокировка/рассылки
// AccountService не имели ни одного теста — deleteAllUserData и
// setTherapistMode покрыты в account.service.spec.ts (лимит ~300 строк на
// файл), этот файл добирает остальную публичную поверхность. Отказ от роли
// терапевта переехал в src/therapy/therapist-exit.service.ts (2026-10-22).
import { AccountService } from './account.service';
import { adoptDeviceTimezone } from './device-timezone';

function makePrisma() {
  const update = jest.fn(() => Promise.resolve({}));
  const updateMany = jest.fn(() => Promise.resolve({ count: 1 }));
  const upsert = jest.fn(() => Promise.resolve({}));
  const findUnique = jest.fn(() => Promise.resolve(null as unknown));
  const findMany = jest.fn(() => Promise.resolve([] as unknown[]));
  const prisma: any = {
    user: { update, updateMany, upsert, findUnique, findMany },
  };
  return prisma;
}

describe('AccountService.registerUser', () => {
  const uid = 555n;

  it('новый юзер: create содержит id, firstName и валидную таймзону', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.registerUser(uid, 'Аня', 'Europe/Moscow');

    const arg = prisma.user.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ id: uid });
    expect(arg.create).toEqual({
      id: uid,
      firstName: 'Аня',
      notifyTimezone: 'Europe/Moscow',
    });
  });

  it('невалидная таймзона не долетает до create (нет ключа notifyTimezone)', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.registerUser(uid, 'Боря', 'Mars/Base');

    const arg = prisma.user.upsert.mock.calls[0][0];
    expect(arg.create).toEqual({ id: uid, firstName: 'Боря' });
  });

  it('без имени и таймзоны create содержит только id', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.registerUser(uid);

    expect(prisma.user.upsert.mock.calls[0][0].create).toEqual({ id: uid });
  });

  it('update: сбрасывает botBlockedAt/deletedAt в null и не трогает firstName, если оно не передано', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.registerUser(uid);

    const arg = prisma.user.upsert.mock.calls[0][0];
    expect(arg.update).toEqual({ botBlockedAt: null, deletedAt: null });
  });

  it('update: если firstName передан — он попадает в update-объект (повторный /start сменит имя)', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.registerUser(uid, 'Вера');

    const arg = prisma.user.upsert.mock.calls[0][0];
    expect(arg.update).toEqual({
      firstName: 'Вера',
      botBlockedAt: null,
      deletedAt: null,
    });
  });
});

// QA 2026-11-03: пояс устройства не доходил до сервера (фронты слали число
// tzOffset, валидатор его отбрасывал), и «сегодня» сервера у всех было
// московским. Пояс устройства становится поясом уведомлений, пока человек не
// выбрал свой сам (notifyTimezoneChosen).
describe('AccountService.registerUser / adoptDeviceTimezone — пояс устройства', () => {
  const uid = 777n;

  it('пояс вне списка выбора, но настоящий IANA (Париж) — тоже принимается', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);
    await service.registerUser(uid, undefined, 'Europe/Paris');
    expect(prisma.user.upsert.mock.calls[0][0].create).toEqual({
      id: uid,
      notifyTimezone: 'Europe/Paris',
    });
  });

  it('у старого юзера пояс меняется только условным UPDATE: не выбран руками и отличается', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);
    const changed = await service.registerUser(
      uid,
      undefined,
      'Asia/Vladivostok',
    );
    expect(changed).toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: uid,
        notifyTimezoneChosen: false,
        NOT: { notifyTimezone: 'Asia/Vladivostok' },
      },
      data: { notifyTimezone: 'Asia/Vladivostok' },
    });
  });

  it('пояс выбран руками (или уже совпадает) — UPDATE ничего не нашёл, false', async () => {
    const prisma = makePrisma();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    expect(await adoptDeviceTimezone(prisma, uid, 'Asia/Vladivostok')).toBe(
      false,
    );
  });

  it('невалидный пояс или его нет (бот /start) — пояс не трогается вовсе', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);
    expect(await service.registerUser(uid, 'Аня', 'Mars/Base')).toBe(false);
    expect(await service.registerUser(uid, 'Аня')).toBe(false);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe('AccountService.getUserFirstName', () => {
  it('возвращает firstName существующего юзера', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Галя' });
    const service = new AccountService(prisma);

    expect(await service.getUserFirstName(1n)).toBe('Галя');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1n },
      select: { firstName: true },
    });
  });

  it('юзер не найден → null (не падает на undefined)', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    expect(await service.getUserFirstName(1n)).toBeNull();
  });

  it('firstName пуст/undefined у существующей строки → null', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ firstName: undefined });
    const service = new AccountService(prisma);

    expect(await service.getUserFirstName(1n)).toBeNull();
  });
});

describe('AccountService.updateName / getUserRole', () => {
  it('updateName пишет ровно переданное имя в firstName нужного юзера', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.updateName(9n, 'Дима');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 9n },
      data: { firstName: 'Дима' },
    });
  });

  it('getUserRole: нет строки/роли → дефолт CLIENT', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    expect(await service.getUserRole(1n)).toBe('CLIENT');
  });

  it('getUserRole: возвращает реальную роль THERAPIST, не дефолт', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ role: 'THERAPIST' });
    const service = new AccountService(prisma);

    expect(await service.getUserRole(1n)).toBe('THERAPIST');
  });
});

describe('AccountService.markUserBlocked', () => {
  it('ставит botBlockedAt только тем, у кого он ещё null (идемпотентно)', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.markUserBlocked(42n);

    const arg = prisma.user.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 42n, botBlockedAt: null });
    expect(arg.data.botBlockedAt).toBeInstanceOf(Date);
  });
});

describe('AccountService.getBroadcastUserIds', () => {
  it('исключает удалённых и заблокировавших бота и отдаёт id как bigint, без округления', async () => {
    const prisma = makePrisma();
    const big = 2n ** 53n + 1n;
    prisma.user.findMany.mockResolvedValue([{ id: 3n }, { id: big }]);
    const service = new AccountService(prisma);

    const ids = await service.getBroadcastUserIds();

    expect(ids).toEqual([3n, big]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, botBlockedAt: null },
      select: { id: true },
    });
  });
});

describe('AccountService.setAdaptiveLevel', () => {
  it('явный выбор частоты сбрасывает notifyIgnoredCount, а не только меняет уровень', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.setAdaptiveLevel(7n, 2);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { notifyAdaptiveLevel: 2, notifyIgnoredCount: 0 },
    });
  });
});

describe('AccountService.getSendSettingsFor', () => {
  it('пустой список id → пустая карта БЕЗ похода в БД', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    const result = await service.getSendSettingsFor([]);

    expect(result.size).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('строит карту по id.toString() с правильными полями для КАЖДОГО юзера отдельно', async () => {
    const prisma = makePrisma();
    prisma.user.findMany.mockResolvedValue([
      {
        id: 1n,
        notifyTimezone: 'Europe/Moscow',
        notifyQuietStart: 22,
        notifyQuietEnd: 8,
        addressForm: 'ty',
        // Привязки нет, номер телеграмный — адресом служит сам userId
        // (старый пользователь бота, строку AuthProvider ему не заводили).
        authProviders: [],
      },
      {
        // Слитый аккаунт: номер веб-диапазона, адрес живёт в привязке.
        id: 1_000_000_000_000_002n,
        notifyTimezone: 'Asia/Almaty',
        notifyQuietStart: 23,
        notifyQuietEnd: 7,
        // Пауза едет в очередь вместе с адресом (R5): проактивные она снимает.
        notifyPausedUntil: new Date('2026-07-20T00:00:00Z'),
        addressForm: 'vy',
        authProviders: [{ providerId: '777' }],
      },
    ]);
    const service = new AccountService(prisma);

    const result = await service.getSendSettingsFor([
      1n,
      1_000_000_000_000_002n,
    ]);

    // Каждый юзер должен читаться под своим ключом и со своими полями —
    // мутант, склеивающий одно значение на всех, не пройдёт эту проверку.
    expect(result.get('1')).toEqual({
      tz: 'Europe/Moscow',
      start: 22,
      end: 8,
      form: 'ty',
      chatId: 1n,
      hasPush: false,
      pausedUntil: null,
    });
    // Адрес взят из привязки, а НЕ из userId: писать по веб-номеру некуда.
    expect(result.get('1000000000000002')).toEqual({
      tz: 'Asia/Almaty',
      start: 23,
      end: 7,
      form: 'vy',
      chatId: 777n,
      hasPush: false,
      pausedUntil: new Date('2026-07-20T00:00:00Z'),
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1n, 1_000_000_000_000_002n] } },
      select: {
        id: true,
        notifyTimezone: true,
        notifyQuietStart: true,
        notifyQuietEnd: true,
        notifyPausedUntil: true,
        addressForm: true,
        authProviders: {
          where: { provider: 'telegram' },
          select: { providerId: true },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });
  });
});

describe('AccountService.getAllUsersWithSettings', () => {
  it('фильтрует по notifyEnabled/botBlockedAt/deletedAt и запрашивает поля рассылки', async () => {
    const prisma = makePrisma();
    const rows = [{ id: 1n, notifyLocalHour: 9 }];
    prisma.user.findMany.mockResolvedValue(rows);
    const service = new AccountService(prisma);

    const result = await service.getAllUsersWithSettings();

    expect(result).toBe(rows);
    // Ключей VAPID в окружении спека нет — ветки «подписка на уведомления в
    // приложении» нет (notify-channel.spec.ts проверяет её отдельно).
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        notifyEnabled: true,
        deletedAt: null,
        OR: [
          {
            botBlockedAt: null,
            OR: [
              { authProviders: { some: { provider: 'telegram' } } },
              { id: { lt: 1_000_000_000_000_000n } },
            ],
          },
        ],
      },
      select: {
        id: true,
        notifyLocalHour: true,
        notifyTimezone: true,
        notifyReminderEnabled: true,
        notifyGamified: true,
        notifyFrequency: true,
        notifyAdaptiveLevel: true,
        notifyIgnoredCount: true,
        notifyNextRemindDate: true,
        notifySkipAckDate: true,
        notifyLastEvalDate: true,
        notifyPausedUntil: true,
        addressForm: true,
      },
    });
  });
});

// Разбор 2026-08-29: соответствие «аккаунт ↔ адрес в Telegram». Сама механика
// живёт в auth/telegram-identity.ts и покрыта там; здесь — что сервис ею
// пользуется и что фолбэк для старых пользователей бота на месте.
describe('AccountService — адрес в Telegram', () => {
  function makeIdentityPrisma(
    rows: Array<{ userId: bigint; providerId: string }> = [],
  ) {
    return {
      authProvider: {
        findUnique: jest.fn(async (args: any) => {
          const wanted = args.where.provider_providerId.providerId;
          const row = rows.find((r) => r.providerId === wanted);
          return row ? { userId: row.userId } : null;
        }),
        findMany: jest.fn(async (args: any) => {
          const ids: bigint[] = args.where.userId.in;
          return rows.filter((r) => ids.some((id) => id === r.userId));
        }),
      },
    } as any;
  }

  it('canonicalUserId у слитого аккаунта отдаёт целевой номер', async () => {
    const prisma = makeIdentityPrisma([
      { userId: 1_000_000_000_000_777n, providerId: '42' },
    ]);
    const service = new AccountService(prisma);
    await expect(service.canonicalUserId(42)).resolves.toBe(
      1_000_000_000_000_777n,
    );
  });

  it('canonicalUserId без привязки отдаёт сам telegramId', async () => {
    const service = new AccountService(makeIdentityPrisma());
    await expect(service.canonicalUserId(42)).resolves.toBe(42n);
  });

  it('telegramIdsFor: телеграмный номер без привязки — сам себе адрес', async () => {
    // Старым пользователям бота строку AuthProvider никогда не заводили: без
    // этого фолбэка рассылка перестала бы до них доходить.
    const service = new AccountService(makeIdentityPrisma());
    const map = await service.telegramIdsFor([42n]);
    expect(map.get('42')).toBe(42n);
  });

  it('telegramIdsFor: веб-номер без привязки в карту не попадает', async () => {
    const service = new AccountService(makeIdentityPrisma());
    const map = await service.telegramIdsFor([1_000_000_000_000_002n]);
    expect(map.has('1000000000000002')).toBe(false);
  });

  it('telegramIdsFor: привязка сильнее фолбэка', async () => {
    const prisma = makeIdentityPrisma([
      { userId: 1_000_000_000_000_777n, providerId: '42' },
    ]);
    const service = new AccountService(prisma);
    const map = await service.telegramIdsFor([1_000_000_000_000_777n]);
    expect(map.get('1000000000000777')).toBe(42n);
  });
});

// QA 2026-11, З5: экран настроек спрашивает «дойдут ли уведомления» у того же
// адреса, по которому их шлёт очередь, — а не у своей копии правила.
describe('AccountService.isNotifyReachable', () => {
  const row = (id: bigint, providers: { providerId: string }[]) => ({
    id,
    notifyTimezone: 'Europe/Moscow',
    notifyQuietStart: 22,
    notifyQuietEnd: 8,
    addressForm: null,
    authProviders: providers,
  });

  it('веб-аккаунт без Telegram — некуда (очередь снимет уведомление)', async () => {
    const prisma = makePrisma();
    prisma.user.findMany.mockResolvedValue([row(1_000_000_000_000_005n, [])]);
    const service = new AccountService(prisma);
    expect(await service.isNotifyReachable(1_000_000_000_000_005n)).toBe(false);
  });

  it('веб-аккаунт с привязанным Telegram и старый пользователь бота — доходят', async () => {
    const prisma = makePrisma();
    prisma.user.findMany.mockResolvedValueOnce([
      row(1_000_000_000_000_006n, [{ providerId: '777' }]),
    ]);
    prisma.user.findMany.mockResolvedValueOnce([row(42n, [])]);
    const service = new AccountService(prisma);
    expect(await service.isNotifyReachable(1_000_000_000_000_006n)).toBe(true);
    expect(await service.isNotifyReachable(42n)).toBe(true);
  });

  it('строки пользователя нет — некуда', async () => {
    const service = new AccountService(makePrisma());
    expect(await service.isNotifyReachable(5n)).toBe(false);
  });
});
