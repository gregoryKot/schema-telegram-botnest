import { BotService, USER_DATA_TABLES } from './bot.service';

// Реестр user-owned таблиц импортируется из сервиса: новая таблица в
// bot.service автоматически попадает под тест полноты каскада.
const THERAPIST_SIDE = [
  'clientConceptualization', 'therapistNote', 'therapyRelation',
  'modeMap', 'therapistCustomMode', 'pair', 'authProvider', 'webSession',
  'therapistRequest', 'subscription',
];

function model(extra: Record<string, any> = {}) {
  return {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    ...extra,
  };
}

function makePrisma() {
  const prisma: any = {
    $transaction: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };
  for (const t of [...USER_DATA_TABLES, ...THERAPIST_SIDE, 'user']) prisma[t] = model();
  // user.findUnique по умолчанию даёт таймзону
  prisma.user.findUnique.mockResolvedValue({ notifyTimezone: 'UTC', role: 'CLIENT' });
  return prisma;
}

describe('BotService.saveRating — валидация', () => {
  it.each([-1, 11, 1.5, NaN, Infinity])('отклоняет некорректное значение %p', async (val) => {
    const prisma = makePrisma();
    await expect(new BotService(prisma).saveRating(1n, 'attachment', val as number)).rejects.toThrow('0..10');
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });

  it('принимает граничные 0 и 10', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).saveRating(1n, 'attachment', 0, '2026-06-08');
    await new BotService(prisma).saveRating(1n, 'limits', 10, '2026-06-08');
    expect(prisma.rating.upsert).toHaveBeenCalledTimes(2);
  });

  it('с явной датой → upsert по этой дате, таймзона не запрашивается', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).saveRating(7n, 'play', 5, '2026-01-15');
    expect(prisma.rating.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_date_needId: { userId: 7n, date: '2026-01-15', needId: 'play' } },
    }));
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('без даты → вычисляет дату по таймзоне пользователя', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).saveRating(7n, 'play', 5);
    expect(prisma.user.findUnique).toHaveBeenCalled();
    expect(prisma.rating.upsert).toHaveBeenCalled();
  });
});

describe('BotService.getRatings', () => {
  it('возвращает map needId→value', async () => {
    const prisma = makePrisma();
    prisma.rating.findMany.mockResolvedValue([
      { needId: 'attachment', value: 7 }, { needId: 'play', value: 3 },
    ]);
    expect(await new BotService(prisma).getRatings(1n, '2026-06-08')).toEqual({ attachment: 7, play: 3 });
  });
});

describe('BotService — роли', () => {
  it('setRole THERAPIST включает therapistMode', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).setRole(1n, 'THERAPIST');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { role: 'THERAPIST', therapistMode: true } });
  });

  it('setRole CLIENT выключает therapistMode', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).setRole(1n, 'CLIENT');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { role: 'CLIENT', therapistMode: false } });
  });

  it('getUserRole возвращает роль или CLIENT по умолчанию', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ role: 'THERAPIST' });
    expect(await new BotService(prisma).getUserRole(1n)).toBe('THERAPIST');
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await new BotService(prisma).getUserRole(1n)).toBe('CLIENT');
  });
});

describe('BotService.registerUser', () => {
  it('upsert с валидной таймзоной', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).registerUser(1n, 'Аня', 'Europe/Moscow');
    const call = prisma.user.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ id: 1n });
    expect(call.create.notifyTimezone).toBe('Europe/Moscow');
  });

  it('игнорирует невалидную таймзону', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).registerUser(1n, 'Аня', 'Mars/Olympus');
    expect(prisma.user.upsert.mock.calls[0][0].create.notifyTimezone).toBeUndefined();
  });
});

describe('BotService — шифрование заметок', () => {
  it('saveNote шифрует текст и теги (в test-env identity)', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).saveNote(1n, '2026-06-08', 'моя заметка', ['a', 'b']);
    const call = prisma.note.upsert.mock.calls[0][0];
    expect(call.create.text).toBeDefined();
    expect(call.create.tags).toBe('a,b');
  });

  it('getNote расшифровывает текст и парсит теги', async () => {
    const prisma = makePrisma();
    prisma.note.findUnique.mockResolvedValue({ text: 'текст', tags: 'x,y,z' });
    expect(await new BotService(prisma).getNote(1n, '2026-06-08')).toEqual({ text: 'текст', tags: ['x', 'y', 'z'] });
  });

  it('getNote без записи → null/пустые теги', async () => {
    const prisma = makePrisma();
    expect(await new BotService(prisma).getNote(1n, '2026-06-08')).toEqual({ text: null, tags: [] });
  });
});

describe('BotService.saveChildhoodRatings', () => {
  it('апсёртит все потребности одной транзакцией', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).saveChildhoodRatings(1n, { attachment: 5, play: 8 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.childhoodRating.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('BotService.deleteAllUserData — полнота каскада (right-to-erasure)', () => {
  it('чистит ВСЕ user-owned таблицы по userId', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).deleteAllUserData(42n);
    for (const t of USER_DATA_TABLES) {
      expect(prisma[t].deleteMany).toHaveBeenCalledWith({ where: { userId: 42n } });
    }
  });

  it('чистит therapist-side данные и удаляет сам User', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).deleteAllUserData(42n);
    expect(prisma.clientConceptualization.deleteMany).toHaveBeenCalledWith({ where: { therapistId: 42n } });
    expect(prisma.therapyRelation.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ therapistId: 42n }, { clientId: 42n }] } });
    expect(prisma.pair.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ userId1: 42n }, { userId2: 42n }] } });
    expect(prisma.authProvider.deleteMany).toHaveBeenCalledWith({ where: { userId: 42n } });
    expect(prisma.webSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 42n } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 42n } });
  });

  it('всё удаление идёт одной транзакцией, затем VACUUM', async () => {
    const prisma = makePrisma();
    await new BotService(prisma).deleteAllUserData(42n);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('VACUUM ANALYZE "User"');
  });

  it('падение VACUUM не роняет удаление (логируется)', async () => {
    const prisma = makePrisma();
    prisma.$executeRawUnsafe.mockRejectedValue(new Error('vacuum busy'));
    await expect(new BotService(prisma).deleteAllUserData(42n)).resolves.toBeUndefined();
  });
});
