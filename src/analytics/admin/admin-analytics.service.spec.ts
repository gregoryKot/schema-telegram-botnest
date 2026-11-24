import { AdminAnalyticsService } from './admin-analytics.service';
import type { AdminAnalyticsQueries } from './admin-analytics.queries';

function emptyQueries(): AdminAnalyticsQueries {
  return {
    activePerDay: async () => new Map(),
    distinctActiveSince: async () => 0,
    newUserMoments: async () => [],
    eventsPerDay: async () => new Map(),
    eventsByNameUser: async () => [],
    totals: async () => ({ users: 0, therapists: 0, clientsInTherapy: 0 }),
    therapists: async () => [],
    peopleInfo: async () => new Map(),
  } as unknown as AdminAnalyticsQueries;
}

describe('AdminAnalyticsService на пустой базе', () => {
  const svc = new AdminAnalyticsService(emptyQueries());

  it.each([7, 30, 90] as const)('overview %i дней', async (days) => {
    const o = await svc.overview(days);
    expect(o.daily).toHaveLength(days);
    expect(o.features).toEqual([]);
    expect(o.totals).toMatchObject({ users: 0, active30: 0, newInPeriod: 0 });
  });

  it('therapists и people — пустые списки', async () => {
    await expect(svc.therapists(30)).resolves.toEqual([]);
    await expect(svc.people(30)).resolves.toEqual([]);
  });
});
