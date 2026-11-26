import { describe, it, expect, vi } from 'vitest';
import {
  THERAPY_PLAN_ITEM_ADDED_EVENT,
  THERAPY_PLAN_ITEM_STATUS_EVENT,
  trackPlanItemAdded,
  trackPlanItemStatus,
} from './planAnalytics';

describe('planAnalytics', () => {
  it('шлёт имена из констант и только известные поля', () => {
    const api = { trackEvent: vi.fn() };
    trackPlanItemAdded(api, 'between', true);
    trackPlanItemStatus(api, 'done', true);
    expect(api.trackEvent.mock.calls).toEqual([
      [THERAPY_PLAN_ITEM_ADDED_EVENT, { rubric: 'between', fromGuide: true }],
      [THERAPY_PLAN_ITEM_STATUS_EVENT, { status: 'done', inPhase: true }],
    ]);
  });
});
