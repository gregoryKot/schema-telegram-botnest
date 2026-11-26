import { describe, it, expect, vi } from 'vitest';
import {
  trackPathCreated,
  trackPathDatesShifted,
  trackPathDraftBuilt,
  trackPathPhaseFinished,
  trackPathPhaseStarted,
  trackPlanSessionMarked,
  withPlanMarkTracking,
} from './pathAnalytics';

describe('pathAnalytics', () => {
  it('шлёт имена и только известные поля; своя фаза и пустой путь — custom и empty', () => {
    const api = { trackEvent: vi.fn() };
    trackPathCreated(api, 'general');
    trackPathCreated(api, null);
    trackPathPhaseStarted(api, 'bonding');
    trackPathPhaseFinished(api, null);
    trackPathDatesShifted(api);
    trackPathDraftBuilt(api, 4);
    trackPlanSessionMarked(api, 2);
    expect(api.trackEvent.mock.calls).toEqual([
      ['therapy_path_created', { template: 'general' }],
      ['therapy_path_created', { template: 'empty' }],
      ['therapy_path_phase_started', { phase: 'bonding' }],
      ['therapy_path_phase_finished', { phase: 'custom' }],
      ['therapy_path_dates_shifted'],
      ['therapy_path_draft_built', { picked: 4 }],
      ['therapy_plan_session_marked', { items: 2 }],
    ]);
  });

  it('отметки в итогах: без пунктов не шлётся; после отказа сервера не шлётся', async () => {
    const api = { trackEvent: vi.fn() };
    const ok = withPlanMarkTracking(api, (_c: string, ids: number[]) =>
      Promise.resolve(ids),
    );
    await ok('7', []);
    expect(api.trackEvent).not.toHaveBeenCalled();
    await ok('7', [1, 2, 3]);
    expect(api.trackEvent).toHaveBeenCalledWith('therapy_plan_session_marked', {
      items: 3,
    });
    api.trackEvent.mockClear();
    const fail = withPlanMarkTracking(api, (_c: string, _ids: number[]) =>
      Promise.reject(new Error('x')),
    );
    await expect(fail('7', [1])).rejects.toThrow();
    expect(api.trackEvent).not.toHaveBeenCalled();
  });
});
