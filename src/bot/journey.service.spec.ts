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
  // Тяжёлые источники в journey.service.ts теперь читаются ДВУМЯ запросами
  // (count() + bounded findMany()) вместо одного unbounded findMany. Дефолт
  // count()/groupBy() в фейке считает по строкам того же (возможно,
  // подменённого оверрайдом) findMany() — старые тесты, мокающие только
  // findMany, продолжают работать без изменений; см. регресс-тест ниже про
  // случай, когда count() и лента обязаны разойтись (>FEED_LIMIT записей).
  const countFromFindMany = jest.fn(function (this: {
    findMany: () => Promise<unknown[]>;
  }) {
    return this.findMany().then((rows) => rows.length);
  });
  const groupByFromFindMany = jest.fn(function (this: {
    findMany: () => Promise<{ tool: string }[]>;
  }) {
    return this.findMany().then((rows) => {
      const byTool = new Map<string, number>();
      for (const r of rows) byTool.set(r.tool, (byTool.get(r.tool) ?? 0) + 1);
      return [...byTool].map(([tool, n]) => ({ tool, _count: { _all: n } }));
    });
  });
  const base: any = {
    rating: { groupBy: empty },
    note: { findMany: empty, count: countFromFindMany },
    schemaDiaryEntry: { findMany: empty, count: countFromFindMany },
    modeDiaryEntry: { findMany: empty, count: countFromFindMany },
    gratitudeDiaryEntry: { findMany: empty, count: countFromFindMany },
    userPractice: { findMany: empty, count: countFromFindMany },
    practicePlan: { findMany: empty },
    ysqResultHistory: { findMany: empty },
    ysqResult: { findUnique: none },
    childhoodRating: { count: zero },
    userBeliefCheck: { findMany: empty, count: countFromFindMany },
    userLetter: { findMany: empty, count: countFromFindMany },
    userFlashcard: { findMany: empty, count: countFromFindMany },
    userSafePlace: { findUnique: none },
    userSchemaNote: { findMany: empty },
    userModeNote: { findMany: empty },
    practiceSession: { findMany: empty, groupBy: groupByFromFindMany },
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
    // Ни один счётчик не отличается от нуля/false — проверяем без полного
    // перечисления полей: тот же литерал жил ещё в двух фронтовых тестах и
    // рос с каждым новым счётчиком (jscpd считал его дублем).
    expect(
      Object.entries(data.counts).filter(([, v]) => v !== 0 && v !== false),
    ).toEqual([]);
    // Новые счётчики быстрых практик присутствуют, а не отсутствуют молча.
    expect(data.counts).toMatchObject({
      breathingSessions: 0,
      groundingSessions: 0,
      stopSessions: 0,
    });
  });

  it('D3: тяжёлый источник — count() даёт полный тотал, лента идёт bounded findMany(take)', async () => {
    // 501 запись дневника схем. Старый код грузил все 501 одним findMany и брал
    // .length; новый — count() для тотала (строки не грузятся) + bounded
    // findMany(take: FEED_LIMIT) для ленты. Проверяем и вывод (тотал ≠ лента),
    // и что запросы пошли именно раздельной парой (count + take).
    const TOTAL = 501;
    const rows = Array.from({ length: TOTAL }, (_, i) => ({
      id: i + 1,
      createdAt: D(new Date(1_700_000_000_000 - i * 1000).toISOString()),
      schemaIds: ['abandonment'],
    }));
    const prisma = makePrisma({
      schemaDiaryEntry: {
        count: jest.fn(async () => TOTAL),
        findMany: jest.fn(async ({ take }: { take?: number }) =>
          rows.slice(0, take ?? rows.length),
        ),
      },
    });
    const { counts, items } = await new JourneyService(prisma).getJourney(uid);

    expect(counts.schemaDiary).toBe(TOTAL); // точный тотал через count()
    expect(items.filter((i) => i.type === 'schema_diary')).toHaveLength(500);
    expect(items).toHaveLength(500); // лента ограничена FEED_LIMIT, не 501
    // Раздельная пара запросов: старый код не звал count и не слал take.
    expect(prisma.schemaDiaryEntry.count).toHaveBeenCalledWith({
      where: { userId: uid },
    });
    expect(prisma.schemaDiaryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500, orderBy: { createdAt: 'desc' } }),
    );
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

  it('быстрые практики: попадают в ленту своим типом и в честные счётчики по инструменту', async () => {
    const prisma = makePrisma({
      practiceSession: {
        findMany: jest.fn(async () => [
          { id: 1, tool: 'breathing', createdAt: D('2026-07-01T09:00:00Z') },
          { id: 2, tool: 'breathing', createdAt: D('2026-07-02T09:00:00Z') },
          { id: 3, tool: 'grounding', createdAt: D('2026-07-03T09:00:00Z') },
          { id: 4, tool: 'stop', createdAt: D('2026-07-04T09:00:00Z') },
        ]),
      },
    });
    const { counts, items } = await new JourneyService(prisma).getJourney(uid);
    expect(counts.breathingSessions).toBe(2);
    expect(counts.groundingSessions).toBe(1);
    expect(counts.stopSessions).toBe(1);
    const types = items.map((i) => i.type);
    expect(types).toContain('breathing');
    expect(types).toContain('grounding');
    expect(types).toContain('stop');
    expect(items[0]).toEqual({
      type: 'stop',
      id: 4,
      at: '2026-07-04T09:00:00.000Z',
    });
  });

  it('остальные источники ленты (заметки, благодарности, тест на убеждения, письма, карточки-подсказки, заметки схем/режимов) попадают в items со своими полями', async () => {
    const prisma = makePrisma({
      note: { findMany: jest.fn(async () => [{ date: '2026-07-06' }]) },
      gratitudeDiaryEntry: {
        findMany: jest.fn(async () => [{ id: 3, date: '2026-07-07' }]),
      },
      userBeliefCheck: {
        findMany: jest.fn(async () => [
          { id: 21, createdAt: D('2026-07-08T09:00:00Z') },
        ]),
      },
      userLetter: {
        findMany: jest.fn(async () => [
          { id: 22, createdAt: D('2026-07-09T09:00:00Z') },
        ]),
      },
      userFlashcard: {
        findMany: jest.fn(async () => [
          {
            id: 23,
            createdAt: D('2026-07-10T09:00:00Z'),
            modeId: 'punitive_parent',
          },
        ]),
      },
      userSchemaNote: {
        findMany: jest.fn(async () => [
          { updatedAt: D('2026-07-11T09:00:00Z'), schemaId: 'defectiveness' },
        ]),
      },
      userModeNote: {
        findMany: jest.fn(async () => [
          { updatedAt: D('2026-07-12T09:00:00Z'), modeId: 'healthy_adult' },
        ]),
      },
    });
    const { counts, items } = await new JourneyService(prisma).getJourney(uid);

    expect(items.find((i) => i.type === 'note')?.at).toBe('2026-07-06');
    expect(items.find((i) => i.type === 'gratitude')).toEqual({
      type: 'gratitude',
      id: 3,
      at: '2026-07-07',
    });
    expect(items.find((i) => i.type === 'belief_check')).toEqual({
      type: 'belief_check',
      id: 21,
      at: '2026-07-08T09:00:00.000Z',
    });
    expect(items.find((i) => i.type === 'letter')).toEqual({
      type: 'letter',
      id: 22,
      at: '2026-07-09T09:00:00.000Z',
    });
    const flashcard = items.find((i) => i.type === 'flashcard');
    expect(flashcard?.modeId).toBe('punitive_parent');
    const schemaNote = items.find((i) => i.type === 'schema_note');
    expect(schemaNote?.schemaIds).toEqual(['defectiveness']);
    const modeNote = items.find((i) => i.type === 'mode_note');
    expect(modeNote?.modeId).toBe('healthy_adult');

    expect(counts.notes).toBe(1);
    expect(counts.gratitudeDays).toBe(1);
    expect(counts.beliefChecks).toBe(1);
    expect(counts.letters).toBe(1);
    expect(counts.flashcards).toBe(1);
    expect(counts.schemaNotes).toBe(1);
    expect(counts.modeNotes).toBe(1);
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
