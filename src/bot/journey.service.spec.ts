import { JourneyService } from './journey.service';

// «Мой путь»: агрегатор архива активности. Проверяем связку
// «данные в таблицах → счётчики и лента»: полные счётчики, слияние и
// сортировка ленты по времени, YSQ-фолбэк для старых пользователей
// (результат без истории) и пустую БД (нули и пустая лента — без NaN/мусора).

const D = (s: string) => new Date(s);

function makePrisma(overrides: Partial<Record<string, unknown>> = {}) {
  const empty = jest.fn(async () => []);
  const none = jest.fn(async () => null);
  const zero = jest.fn(async () => 0);
  const base: any = {
    rating: { groupBy: empty },
    note: { findMany: empty },
    schemaDiaryEntry: { findMany: empty },
    modeDiaryEntry: { findMany: empty },
    gratitudeDiaryEntry: { findMany: empty },
    userPractice: { findMany: empty },
    practicePlan: { findMany: empty },
    ysqResultHistory: { findMany: empty },
    ysqResult: { findUnique: none },
    childhoodRating: { count: zero },
    userBeliefCheck: { findMany: empty },
    userLetter: { findMany: empty },
    userFlashcard: { findMany: empty },
    userSafePlace: { findUnique: none },
    userSchemaNote: { findMany: empty },
    userModeNote: { findMany: empty },
  };
  for (const [model, methods] of Object.entries(overrides)) {
    base[model] = { ...base[model], ...(methods as object) };
  }
  return base;
}

const uid = 42n;

describe('JourneyService', () => {
  it('пустая БД → нулевые счётчики и пустая лента', async () => {
    const service = new JourneyService(makePrisma());
    const data = await service.getJourney(uid);
    expect(data.items).toEqual([]);
    expect(data.counts).toEqual({
      trackerDays: 0,
      notes: 0,
      schemaDiary: 0,
      modeDiary: 0,
      gratitudeDays: 0,
      practices: 0,
      plansDone: 0,
      ysqTests: 0,
      childhoodDone: false,
      beliefChecks: 0,
      letters: 0,
      flashcards: 0,
      safePlace: false,
      schemaNotes: 0,
      modeNotes: 0,
    });
  });

  it('склеивает ленту из всех источников и сортирует по времени (новые сверху)', async () => {
    const prisma = makePrisma({
      rating: {
        groupBy: jest.fn(async () => [
          { date: '2026-07-01' },
          { date: '2026-07-03' },
        ]),
      },
      modeDiaryEntry: {
        findMany: jest.fn(async () => [
          {
            id: 7,
            createdAt: D('2026-07-02T10:00:00Z'),
            modeId: 'vulnerable_child',
          },
        ]),
      },
      schemaDiaryEntry: {
        findMany: jest.fn(async () => [
          {
            createdAt: D('2026-07-04T08:00:00Z'),
            schemaIds: ['abandonment', 7],
          },
        ]),
      },
      userPractice: {
        findMany: jest.fn(async () => [
          { createdAt: D('2026-06-30T12:00:00Z'), needId: 'play' },
        ]),
      },
    });
    const service = new JourneyService(prisma);
    const { counts, items } = await service.getJourney(uid);

    expect(items.map((i) => i.type)).toEqual([
      'schema_diary',
      'tracker_day',
      'mode_diary',
      'tracker_day',
      'practice',
    ]);
    // Нестроковые элементы Json-поля schemaIds отбрасываются, а не ломают ответ
    expect(items[0].schemaIds).toEqual(['abandonment']);
    expect(items[2].modeId).toBe('vulnerable_child');
    // id доезжает до ленты — по нему фронт тянет содержимое для карточки-результата
    expect(items[2].id).toBe(7);
    expect(items[4].needId).toBe('play');
    expect(counts.trackerDays).toBe(2);
    expect(counts.schemaDiary).toBe(1);
    expect(counts.modeDiary).toBe(1);
    expect(counts.practices).toBe(1);
  });

  it('YSQ: история есть → считаем по истории', async () => {
    const prisma = makePrisma({
      ysqResultHistory: {
        findMany: jest.fn(async () => [
          { id: 11, completedAt: D('2026-07-01T00:00:00Z') },
          { id: 12, completedAt: D('2026-07-05T00:00:00Z') },
        ]),
      },
      ysqResult: {
        findUnique: jest.fn(async () => ({
          completedAt: D('2026-07-05T00:00:00Z'),
        })),
      },
    });
    const { counts, items } = await new JourneyService(prisma).getJourney(uid);
    expect(counts.ysqTests).toBe(2);
    expect(items.filter((i) => i.type === 'ysq')).toHaveLength(2);
    // id истории доезжает — по нему фронт находит запись для карточки-результата
    expect(items.map((i) => i.id).sort()).toEqual([11, 12]);
  });

  it('YSQ-фолбэк: старый юзер без истории, но с результатом → 1 прохождение', async () => {
    const prisma = makePrisma({
      ysqResult: {
        findUnique: jest.fn(async () => ({
          completedAt: D('2025-12-01T00:00:00Z'),
        })),
      },
    });
    const { counts, items } = await new JourneyService(prisma).getJourney(uid);
    expect(counts.ysqTests).toBe(1);
    expect(items).toEqual([{ type: 'ysq', at: '2025-12-01T00:00:00.000Z' }]);
  });

  it('план без checkedAt берёт дату из scheduledDate; булевы флаги считаются', async () => {
    const prisma = makePrisma({
      practicePlan: {
        findMany: jest.fn(async () => [
          { checkedAt: null, scheduledDate: '2026-07-10', needId: 'limits' },
        ]),
      },
      childhoodRating: { count: jest.fn(async () => 5) },
      userSafePlace: {
        findUnique: jest.fn(async () => ({
          updatedAt: D('2026-07-11T09:00:00Z'),
        })),
      },
    });
    const { counts, items } = await new JourneyService(prisma).getJourney(uid);
    expect(counts.plansDone).toBe(1);
    expect(counts.childhoodDone).toBe(true);
    expect(counts.safePlace).toBe(true);
    expect(items.find((i) => i.type === 'plan_done')?.at).toBe('2026-07-10');
    // фильтр done: true уходит в запрос — выполненные, а не все планы
    expect(prisma.practicePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: uid, done: true } }),
    );
  });

  it('лента обрезается потолком, счётчики остаются полными', async () => {
    const many = Array.from({ length: 600 }, (_, i) => ({
      createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000),
      needId: 'play',
    }));
    const prisma = makePrisma({
      userPractice: { findMany: jest.fn(async () => many) },
    });
    const { counts, items } = await new JourneyService(prisma).getJourney(uid);
    expect(counts.practices).toBe(600);
    expect(items).toHaveLength(500);
  });
});
