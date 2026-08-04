// Волна В mutation-покрытия (2026-08): registerUser/роль/блокировка/рассылки
// AccountService не имели ни одного теста — deleteAllUserData и
// resignTherapist/setTherapistMode покрыты в account.service.spec.ts (лимит
// ~300 строк на файл), этот файл добирает остальную публичную поверхность.
import { AccountService } from './account.service';

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

describe('AccountService.setRole', () => {
  it('повышение до THERAPIST одновременно включает therapistMode', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.setRole(3n, 'THERAPIST');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3n },
      data: { role: 'THERAPIST', therapistMode: true },
    });
  });

  it('понижение до CLIENT одновременно выключает therapistMode (не оставляет висеть кабинет)', async () => {
    const prisma = makePrisma();
    const service = new AccountService(prisma);

    await service.setRole(3n, 'CLIENT');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3n },
      data: { role: 'CLIENT', therapistMode: false },
    });
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

describe('AccountService.getAllUserIds / getBroadcastUserIds', () => {
  it('getAllUserIds конвертирует bigint id в number для КАЖДОГО юзера, без фильтра', async () => {
    const prisma = makePrisma();
    prisma.user.findMany.mockResolvedValue([{ id: 1n }, { id: 2n }]);
    const service = new AccountService(prisma);

    const ids = await service.getAllUserIds();

    expect(ids).toEqual([1, 2]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({ select: { id: true } });
  });

  it('getBroadcastUserIds исключает удалённых и заблокировавших бота', async () => {
    const prisma = makePrisma();
    prisma.user.findMany.mockResolvedValue([{ id: 3n }]);
    const service = new AccountService(prisma);

    const ids = await service.getBroadcastUserIds();

    expect(ids).toEqual([3]);
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
      },
      {
        id: 2n,
        notifyTimezone: 'Asia/Almaty',
        notifyQuietStart: 23,
        notifyQuietEnd: 7,
        addressForm: 'vy',
      },
    ]);
    const service = new AccountService(prisma);

    const result = await service.getSendSettingsFor([1n, 2n]);

    // Каждый юзер должен читаться под своим ключом и со своими полями —
    // мутант, склеивающий одно значение на всех, не пройдёт эту проверку.
    expect(result.get('1')).toEqual({
      tz: 'Europe/Moscow',
      start: 22,
      end: 8,
      form: 'ty',
    });
    expect(result.get('2')).toEqual({
      tz: 'Asia/Almaty',
      start: 23,
      end: 7,
      form: 'vy',
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1n, 2n] } },
      select: {
        id: true,
        notifyTimezone: true,
        notifyQuietStart: true,
        notifyQuietEnd: true,
        addressForm: true,
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
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { notifyEnabled: true, botBlockedAt: null, deletedAt: null },
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
