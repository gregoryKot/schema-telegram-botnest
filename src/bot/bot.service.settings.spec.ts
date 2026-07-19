import { BotService } from './bot.service';

// Stateful in-memory fake Prisma — заметки, настройки/денормализованные
// коллекции, детские оценки, отмена pre_reminder, дисклеймер. Оценки
// потребностей (rating) — bot.service.spec.ts (лимит ~300 строк на файл).
function makeDb(userRow: Record<string, unknown> = {}) {
  const notes: any[] = [];
  const childhoodRatings: any[] = [];
  const notifications: any[] = [];
  const user: any = { notifyTimezone: 'Europe/Moscow', ...userRow };

  const db: any = {
    user: {
      findUnique: jest.fn(() => ({ ...user })),
      update: jest.fn(({ data }: any) => {
        Object.assign(user, data);
        return { ...user };
      }),
    },
    note: {
      findUnique: jest.fn(({ where }: any) => {
        const key = where.userId_date;
        return (
          notes.find((n) => n.userId === key.userId && n.date === key.date) ??
          null
        );
      }),
      upsert: jest.fn(({ where, update, create }: any) => {
        const key = where.userId_date;
        const existing = notes.find(
          (n) => n.userId === key.userId && n.date === key.date,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { ...create };
        notes.push(row);
        return row;
      }),
    },
    childhoodRating: {
      findMany: jest.fn(({ where }: any) =>
        childhoodRatings.filter((r) => r.userId === where.userId),
      ),
      upsert: jest.fn(({ where, update, create }: any) => {
        const key = where.userId_needId;
        const existing = childhoodRatings.find(
          (r) => r.userId === key.userId && r.needId === key.needId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { ...create };
        childhoodRatings.push(row);
        return row;
      }),
    },
    scheduledNotification: {
      updateMany: jest.fn(({ where }: any) => {
        const matched = notifications.filter(
          (n) =>
            n.type === where.type &&
            n.sentAt === where.sentAt &&
            n.cancelledAt === where.cancelledAt,
        );
        matched.forEach((n) => (n.cancelledAt = new Date()));
        return { count: matched.length };
      }),
    },
    // $transaction для saveChildhoodRatings — исполняет массив промисов, как
    // это делает реальный Prisma для batch-варианта.
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    _user: user,
    _notifications: notifications,
  };
  return db;
}

describe('BotService.getNote / saveNote — read-after-write', () => {
  it('сохранённая заметка и теги читаются назад как есть', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveNote(1n, '2026-07-16', 'сегодня было тревожно', [
      'anxiety',
      'work',
    ]);
    const note = await svc.getNote(1n, '2026-07-16');

    expect(note.text).toBe('сегодня было тревожно');
    expect(note.tags).toEqual(['anxiety', 'work']);
  });

  it('нет заметки на дату → text null, tags []', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    const note = await svc.getNote(1n, '2026-07-16');

    expect(note.text).toBeNull();
    expect(note.tags).toEqual([]);
  });

  it('повторное сохранение заметки на ту же дату обновляет, а не дублирует', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveNote(1n, '2026-07-16', 'первая версия');
    await svc.saveNote(1n, '2026-07-16', 'вторая версия');

    const note = await svc.getNote(1n, '2026-07-16');
    expect(note.text).toBe('вторая версия');
  });
});

describe('BotService.getUserSettings / updateUserSettings — read-after-write денормализованных списков', () => {
  it('mySchemaIds/myModeIds, записанные через updateUserSettings, читаются назад расшифрованными', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.updateUserSettings(1n, {
      mySchemaIds: ['defectiveness', 'abandonment'],
      myModeIds: ['vulnerable_child'],
    });
    const settings = await svc.getUserSettings(1n);

    expect(settings?.mySchemaIds).toEqual(['defectiveness', 'abandonment']);
    expect(settings?.myModeIds).toEqual(['vulnerable_child']);
  });

  it('несуществующий пользователь → getUserSettings возвращает null (не падает на decryptRecord)', async () => {
    const db = makeDb();
    db.user.findUnique = jest.fn(() => null);
    const svc = new BotService(db);

    expect(await svc.getUserSettings(1n)).toBeNull();
  });
});

describe('BotService.getChildhoodRatings / saveChildhoodRatings — read-after-write', () => {
  it('сохранённые оценки читаются назад по needId', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveChildhoodRatings(1n, { attachment: 6, autonomy: 2 });
    const result = await svc.getChildhoodRatings(1n);

    expect(result).toEqual({ attachment: 6, autonomy: 2 });
  });

  it('сохранение батчем идёт одной транзакцией (атомарность)', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveChildhoodRatings(1n, { attachment: 6, autonomy: 2 });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('BotService.acceptDisclaimer / hasAcceptedDisclaimer', () => {
  it('до принятия — false; после acceptDisclaimer — true', async () => {
    const db = makeDb({ disclaimerAccepted: false });
    const svc = new BotService(db);

    expect(await svc.hasAcceptedDisclaimer(1n)).toBe(false);
    await svc.acceptDisclaimer(1n);
    expect(await svc.hasAcceptedDisclaimer(1n)).toBe(true);
  });
});

describe('BotService.cancelAllPreReminders', () => {
  it('отменяет только неотправленные и ещё не отменённые pre_reminder', async () => {
    const db = makeDb();
    const svc = new BotService(db);
    db._notifications.push(
      { type: 'pre_reminder', sentAt: null, cancelledAt: null },
      { type: 'pre_reminder', sentAt: null, cancelledAt: null },
    );

    const n = await svc.cancelAllPreReminders();

    expect(n).toBe(2);
    expect(db.scheduledNotification.updateMany).toHaveBeenCalledWith({
      where: { type: 'pre_reminder', sentAt: null, cancelledAt: null },
      data: { cancelledAt: expect.any(Date) },
    });
  });
});
