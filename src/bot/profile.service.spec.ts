import { ProfileService } from './profile.service';

function makeDeps(user: any = null, ysqResult: any = null) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    ysqResult: { findUnique: jest.fn().mockResolvedValue(ysqResult) },
    schemaDiaryEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    modeDiaryEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    gratitudeDiaryEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    rating: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  const analytics = { getStreakData: jest.fn().mockResolvedValue({ currentStreak: 0 }) } as any;
  return { prisma, analytics };
}

describe('ProfileService.getProfile', () => {
  it('дефолты для нового пользователя (user = null)', async () => {
    const { prisma, analytics } = makeDeps(null);
    const p = await new ProfileService(prisma, analytics).getProfile(1n);
    expect(p.name).toBeNull();
    expect(p.role).toBe('CLIENT');
    expect(p.notifications).toEqual({ enabled: true, reminderEnabled: true, timezone: 'Europe/Moscow', localHour: 21 });
    expect(p.ysq).toEqual({ completedAt: null, activeSchemaIds: [] });
    expect(p.mySchemaIds).toEqual([]);
  });

  it('берёт имя, роль и настройки из user', async () => {
    const { prisma, analytics } = makeDeps({
      firstName: 'Аня', role: 'THERAPIST', notifyEnabled: false,
      notifyReminderEnabled: false, notifyTimezone: 'Asia/Tokyo', notifyLocalHour: 9,
      mySchemaIds: ['ed'], myModeIds: ['hc'],
    });
    const p = await new ProfileService(prisma, analytics).getProfile(1n);
    expect(p.name).toBe('Аня');
    expect(p.role).toBe('THERAPIST');
    expect(p.notifications).toEqual({ enabled: false, reminderEnabled: false, timezone: 'Asia/Tokyo', localHour: 9 });
    expect(p.mySchemaIds).toEqual(['ed']);
    expect(p.myModeIds).toEqual(['hc']);
  });

  it('вычисляет активные схемы YSQ из ответов', async () => {
    // emotional_deprivation (вопросы 1..5): 3 из 5 ≥5 → 60% > 50 → активна
    const answers = new Array(116).fill(0);
    answers[0] = answers[1] = answers[2] = 5;
    const { prisma, analytics } = makeDeps(null, { completedAt: new Date('2026-01-01'), answers });
    const p = await new ProfileService(prisma, analytics).getProfile(1n);
    expect(p.ysq.activeSchemaIds).toContain('emotional_deprivation');
    expect(p.ysq.completedAt).toEqual(new Date('2026-01-01'));
  });

  it('streak берётся из аналитики; даты последней активности форматируются', async () => {
    const { prisma, analytics } = makeDeps({ firstName: 'X' });
    analytics.getStreakData.mockResolvedValue({ currentStreak: 7 });
    prisma.rating.findFirst.mockResolvedValue({ date: '2026-06-08' });
    prisma.schemaDiaryEntry.findFirst.mockResolvedValue({ createdAt: new Date('2026-06-07T10:00:00Z') });
    const p = await new ProfileService(prisma, analytics).getProfile(1n);
    expect(p.streak).toBe(7);
    expect(p.lastActivity.needsTracker).toBe('2026-06-08');
    expect(p.lastActivity.schemaDiary).toBe('2026-06-07'); // ISO → YYYY-MM-DD
    expect(p.lastActivity.modeDiary).toBeNull();
  });
});
