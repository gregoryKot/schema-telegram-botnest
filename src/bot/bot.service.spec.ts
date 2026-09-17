import { BotService, NEED_IDS, Need } from './bot.service';

// Полный ожидаемый список потребностей — Stryker мутирует строковые
// литералы (эмодзи/заголовки) в приватном поле needs; без этой проверки
// такие мутанты (не относящиеся к логам) survive молча, хотя это
// user-facing текст, который реально показывается в боте.
const EXPECTED_NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: '🤝 Привязанность',
    fullTitle:
      'Безопасная привязанность\n(безопасность, стабильность, забота, принятие)',
    chartLabel: 'Привязанность',
  },
  {
    id: 'autonomy',
    emoji: '🚀',
    title: '🚀 Автономия',
    fullTitle: 'Автономия, компетентность и чувство идентичности',
    chartLabel: 'Автономия',
  },
  {
    id: 'expression',
    emoji: '💬',
    title: '💬 Выражение чувств',
    fullTitle: 'Свобода выражать потребности и эмоции',
    chartLabel: 'Выражение чувств',
  },
  {
    id: 'play',
    emoji: '🎉',
    title: '🎉 Спонтанность',
    fullTitle: 'Спонтанность и игра',
    chartLabel: 'Спонтанность',
  },
  {
    id: 'limits',
    emoji: '⚖️',
    title: '⚖️ Границы',
    fullTitle: 'Реалистичные границы и самоконтроль',
    chartLabel: 'Границы',
  },
];

describe('BotService.getNeeds', () => {
  it('возвращает все 5 потребностей с полным текстовым содержимым, в фиксированном порядке', () => {
    const svc = new BotService({} as never);
    expect(svc.getNeeds()).toEqual(EXPECTED_NEEDS);
  });
});

// Stateful in-memory fake Prisma — таблицы rating + user (таймзона для
// вычисления даты по умолчанию). Заметки/настройки/детские оценки —
// bot.service.settings.spec.ts (лимит ~300 строк на файл).
function makeDb(userRow: Record<string, unknown> = {}) {
  const ratings: any[] = [];
  const user: any = { notifyTimezone: 'Europe/Moscow', ...userRow };

  const db: any = {
    user: {
      findUnique: jest.fn(() => ({ ...user })),
    },
    rating: {
      upsert: jest.fn(({ where, update, create }: any) => {
        const key = where.userId_date_needId;
        const existing = ratings.find(
          (r) =>
            r.userId === key.userId &&
            r.date === key.date &&
            r.needId === key.needId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { ...create };
        ratings.push(row);
        return row;
      }),
      findMany: jest.fn(({ where }: any) =>
        ratings.filter(
          (r) => r.userId === where.userId && r.date === where.date,
        ),
      ),
    },
    _user: user,
    _ratings: ratings,
  };
  return db;
}

describe('BotService.saveRating / getRatings — read-after-write', () => {
  it('сохранённая оценка читается назад с тем же значением', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveRating(1n, 'attachment', 7, '2026-07-16');
    const ratings = await svc.getRatings(1n, '2026-07-16');

    expect(ratings.attachment).toBe(7);
  });

  it('повторное сохранение той же потребности/даты обновляет значение, а не дублирует строку', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveRating(1n, 'autonomy', 3, '2026-07-16');
    await svc.saveRating(1n, 'autonomy', 9, '2026-07-16');

    expect(db._ratings.length).toBe(1);
    const ratings = await svc.getRatings(1n, '2026-07-16');
    expect(ratings.autonomy).toBe(9);
  });

  it('оценки на разные даты не смешиваются (read-after-write по дате)', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveRating(1n, 'play', 5, '2026-07-15');
    await svc.saveRating(1n, 'play', 8, '2026-07-16');

    expect((await svc.getRatings(1n, '2026-07-15')).play).toBe(5);
    expect((await svc.getRatings(1n, '2026-07-16')).play).toBe(8);
  });

  it('оценки разных пользователей на одну дату изолированы друг от друга', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveRating(1n, 'limits', 2, '2026-07-16');
    await svc.saveRating(2n, 'limits', 9, '2026-07-16');

    expect((await svc.getRatings(1n, '2026-07-16')).limits).toBe(2);
    expect((await svc.getRatings(2n, '2026-07-16')).limits).toBe(9);
  });

  it('все NEED_IDS можно сохранить независимо на одну дату', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    for (const [i, needId] of NEED_IDS.entries()) {
      await svc.saveRating(1n, needId, i, '2026-07-16');
    }
    const ratings = await svc.getRatings(1n, '2026-07-16');
    NEED_IDS.forEach((needId, i) => expect(ratings[needId]).toBe(i));
  });
});

describe('BotService.saveRating — валидация границ value', () => {
  it.each([-1, 11, 100, -100])(
    'отклоняет value=%i (вне диапазона 0..10)',
    async (value) => {
      const db = makeDb();
      const svc = new BotService(db);
      await expect(
        svc.saveRating(1n, 'attachment', value, '2026-07-16'),
      ).rejects.toThrow('Rating must be integer 0..10');
    },
  );

  it.each([0.5, 3.3, NaN])('отклоняет нецелое value=%s', async (value) => {
    const db = makeDb();
    const svc = new BotService(db);
    await expect(
      svc.saveRating(1n, 'attachment', value, '2026-07-16'),
    ).rejects.toThrow('Rating must be integer 0..10');
  });

  it.each([0, 10, 5])(
    'принимает граничные/среднее значения value=%i',
    async (value) => {
      const db = makeDb();
      const svc = new BotService(db);
      await svc.saveRating(1n, 'attachment', value, '2026-07-16');
      expect((await svc.getRatings(1n, '2026-07-16')).attachment).toBe(value);
    },
  );

  it('невалидное значение не долетает до Prisma (upsert не вызывается)', async () => {
    const db = makeDb();
    const svc = new BotService(db);
    await expect(
      svc.saveRating(1n, 'attachment', 11, '2026-07-16'),
    ).rejects.toThrow();
    expect(db.rating.upsert).not.toHaveBeenCalled();
  });
});

describe('BotService — дата по умолчанию берётся из таймзоны юзера (localDate)', () => {
  // 2026-07-16T23:30:00Z — поздний вечер по UTC. В Москве (UTC+3) это уже
  // 17 июля, в Лос-Анджелесе (UTC-7) — ещё 16 июля. Проверяем, что
  // saveRating/getRatings реально используют notifyTimezone юзера, а не
  // константу/UTC — иначе трекер «сегодня» покажет неверный день.
  const FIXED = new Date('2026-07-16T23:30:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED);
  });
  afterEach(() => jest.useRealTimers());

  it('без явной даты использует локальную дату по notifyTimezone (Москва → уже завтра)', async () => {
    const db = makeDb({ notifyTimezone: 'Europe/Moscow' });
    const svc = new BotService(db);

    await svc.saveRating(1n, 'attachment', 4);

    expect(db._ratings[0].date).toBe('2026-07-17');
  });

  it('без явной даты использует локальную дату по notifyTimezone (LA → ещё сегодня)', async () => {
    const db = makeDb({ notifyTimezone: 'America/Los_Angeles' });
    const svc = new BotService(db);

    await svc.saveRating(1n, 'attachment', 4);

    expect(db._ratings[0].date).toBe('2026-07-16');
  });

  it('явно переданная дата не требует похода за таймзоной юзера и используется как есть', async () => {
    const db = makeDb();
    const svc = new BotService(db);

    await svc.saveRating(1n, 'attachment', 4, '2026-01-01');

    // Голое not.toHaveBeenCalled() не поймало бы мутанта, который зовёт
    // userTimezone(), но игнорирует её результат (условие `date ?? …`
    // выродилось бы в «всегда взять таймзону», а итоговая дата всё равно
    // осталась бы переданной) — проверяем и факт похода, и что записалась
    // именно переданная дата, а не результат localDateString().
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db._ratings).toHaveLength(1);
    expect(db._ratings[0].date).toBe('2026-01-01');
  });

  it('нет notifyTimezone у юзера → дефолт Europe/Moscow', async () => {
    const db = makeDb();
    db._user.notifyTimezone = null;
    const svc = new BotService(db);

    await svc.saveRating(1n, 'attachment', 4);

    expect(db._ratings[0].date).toBe('2026-07-17');
  });
});
