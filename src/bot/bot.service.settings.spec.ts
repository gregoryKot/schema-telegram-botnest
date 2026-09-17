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

  // Без явного tags-аргумента tagsPlain = '' (не 'undefined' и не падение на
  // .join) — мутант, меняющий `tags ? tags.join(',') : ''` на всегда-join,
  // упал бы на TypeError, а мутант с другим дефолтом дал бы tags=[''] вместо [].
  it('saveNote без аргумента tags → getNote возвращает пустой массив тегов, а не [""]', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveNote(1n, '2026-07-16', 'без тегов');
    const note = await svc.getNote(1n, '2026-07-16');

    expect(note.tags).toEqual([]);
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

  // uiPrefs — plain JSON (не в EncryptSchema), должен пройти через
  // encryptRecord/decryptRecord неизменным (read-after-write).
  it('uiPrefs, записанный через updateUserSettings, читается назад как есть (plain-поле)', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.updateUserSettings(1n, {
      uiPrefs: { today_streak_hidden: '1', today_focus_practice: 'tracker' },
    });
    const settings = await svc.getUserSettings(1n);

    expect(settings?.uiPrefs).toEqual({
      today_streak_hidden: '1',
      today_focus_practice: 'tracker',
    });
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

  it('сохранение батчем идёт одной транзакцией с одной операцией на каждую потребность (атомарность)', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveChildhoodRatings(1n, { attachment: 6, autonomy: 2 });

    // Голое toHaveBeenCalledTimes(1) не поймало бы мутанта, вызывающего
    // upsert по одному вне $transaction (тогда мок тоже был бы вызван 1
    // раз — просто с пустым/иным массивом). Проверяем реальный аргумент:
    // массив из ровно двух промисов, по числу переданных потребностей —
    // если саму запись «размотать» из транзакции, вызов $transaction либо
    // не произойдёт вовсе, либо придёт с другой формой аргумента.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const opsArg = db.$transaction.mock.calls[0][0];
    expect(Array.isArray(opsArg)).toBe(true);
    expect(opsArg).toHaveLength(2);
    expect(db.childhoodRating.upsert).toHaveBeenCalledTimes(2);
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

  // Поле отсутствует (undefined), а не явно false — только этот случай реально
  // проверяет `?? false`: при disclaimerAccepted=false оператор `??` не
  // срабатывает вовсе (false не nullish), и мутант `?? true` прошёл бы мимо.
  it('поле disclaimerAccepted отсутствует у строки → false, а не true', async () => {
    const db = makeDb();
    delete db._user.disclaimerAccepted;
    const svc = new BotService(db);

    expect(await svc.hasAcceptedDisclaimer(1n)).toBe(false);
  });

  it('юзер не найден в БД → false, а не падение', async () => {
    const db = makeDb();
    db.user.findUnique = jest.fn(() => null);
    const svc = new BotService(db);

    expect(await svc.hasAcceptedDisclaimer(1n)).toBe(false);
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
