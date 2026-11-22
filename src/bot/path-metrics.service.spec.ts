import { PathMetricsService } from './path-metrics.service';

describe('PathMetricsService', () => {
  it('один groupBy по именам событий пути; нет строки — ноль', async () => {
    const groupBy = jest.fn(() =>
      Promise.resolve([
        { name: 'therapy_path_created', _count: { _all: 2 } },
        { name: 'therapy_path_phase_started', _count: { _all: 5 } },
        { name: 'therapy_plan_session_marked', _count: { _all: 4 } },
      ]),
    );
    const service = new PathMetricsService({
      analyticsEvent: { groupBy },
    } as never);
    await expect(service.getMetrics()).resolves.toEqual({
      created30: 2,
      phasesStarted30: 5,
      phasesFinished30: 0,
      sessionsMarked30: 4,
      shifted30: 0,
      drafts30: 0,
    });
    expect(groupBy).toHaveBeenCalledTimes(1);
  });
});
