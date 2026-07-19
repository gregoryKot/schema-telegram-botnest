import { ProfileService } from './profile.service';

// getProfile агрегирует 7 источников параллельно (Promise.all) — приоритет
// теста: правильная сборка (активные схемы из ysq, денормализованные
// mySchemaIds/myModeIds расшифрованы, стрик из analytics) и безопасные
// дефолты для «пустого» аккаунта (никогда не должно падать/подставлять
// чужие данные, см. правило CLAUDE.md про хардкод-заглушки).
function makeAnswers(activeIdx: number[]): number[] {
  const answers = new Array(116).fill(0);
  for (const i of activeIdx) answers[i] = 5;
  return answers;
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: { findUnique: jest.fn(() => null) },
    ysqResult: { findUnique: jest.fn(() => null) },
    schemaDiaryEntry: { findFirst: jest.fn(() => null) },
    modeDiaryEntry: { findFirst: jest.fn(() => null) },
    gratitudeDiaryEntry: { findFirst: jest.fn(() => null) },
    rating: { findFirst: jest.fn(() => null) },
    ...overrides,
  } as any;
}

function makeAnalytics(streak = 0) {
  return {
    getStreakData: jest.fn(() => ({ currentStreak: streak })),
  } as any;
}

describe('ProfileService.getProfile — пустой аккаунт: безопасные дефолты, не чужие данные', () => {
  it('без единой записи в БД — нейтральные значения, а не заглушки', async () => {
    const svc = new ProfileService(makePrisma(), makeAnalytics(0));

    const profile = await svc.getProfile(1n);

    expect(profile.name).toBeNull();
    expect(profile.role).toBe('CLIENT');
    expect(profile.ysq.completedAt).toBeNull();
    expect(profile.ysq.activeSchemaIds).toEqual([]);
    expect(profile.streak).toBe(0);
    expect(profile.lastActivity).toEqual({
      needsTracker: null,
      schemaDiary: null,
      modeDiary: null,
      gratitudeDiary: null,
    });
    expect(profile.mySchemaIds).toEqual([]);
    expect(profile.myModeIds).toEqual([]);
  });
});

describe('ProfileService.getProfile — агрегация реальных данных', () => {
  it('активные схемы считаются из последнего YsqResult.answers', async () => {
    const prisma = makePrisma({
      ysqResult: {
        findUnique: jest.fn(() => ({
          completedAt: new Date('2026-07-01'),
          answers: makeAnswers([0, 1, 2, 3, 4]), // все 5 вопросов emotional_deprivation
        })),
      },
    });
    const svc = new ProfileService(prisma, makeAnalytics());

    const profile = await svc.getProfile(1n);

    expect(profile.ysq.completedAt).toEqual(new Date('2026-07-01'));
    expect(profile.ysq.activeSchemaIds).toContain('emotional_deprivation');
  });

  it('mySchemaIds/myModeIds читаются из User и расшифровываются', async () => {
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn(() => ({
          firstName: 'Аня',
          role: 'CLIENT',
          mySchemaIds: JSON.stringify(['abandonment']),
          myModeIds: JSON.stringify(['vulnerable_child']),
        })),
      },
    });
    const svc = new ProfileService(prisma, makeAnalytics());

    const profile = await svc.getProfile(1n);

    expect(profile.name).toBe('Аня');
    expect(profile.mySchemaIds).toEqual(['abandonment']);
    expect(profile.myModeIds).toEqual(['vulnerable_child']);
  });

  it('стрик берётся из BotAnalyticsService.getStreakData, а не пересчитывается локально', async () => {
    const svc = new ProfileService(makePrisma(), makeAnalytics(7));

    const profile = await svc.getProfile(1n);

    expect(profile.streak).toBe(7);
  });

  it('lastActivity.needsTracker берёт дату последней оценки (rating), не дневника', async () => {
    const prisma = makePrisma({
      rating: {
        findFirst: jest.fn(() => ({ date: '2026-07-10' })),
      },
    });
    const svc = new ProfileService(prisma, makeAnalytics());

    const profile = await svc.getProfile(1n);

    expect(profile.lastActivity.needsTracker).toBe('2026-07-10');
  });
});
