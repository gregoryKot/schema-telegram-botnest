import { describe, it, expect, vi, beforeEach } from 'vitest';

const trackEvent = vi.fn();
vi.mock('../../api', () => ({ api: { trackEvent: (...a: unknown[]) => trackEvent(...a) } }));

import { trackHomeTile, trackTrackerSkip } from './trackHomeTile';

describe('trackHomeTile', () => {
  beforeEach(() => trackEvent.mockReset());

  it('шлёт home_tile с именем плитки и больше ничем', () => {
    trackHomeTile('feed_all');
    expect(trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'feed_all' });
  });

  it('пропуск вопроса трекера — событие tracker_skip без meta', () => {
    trackTrackerSkip();
    expect(trackEvent).toHaveBeenCalledWith('tracker_skip');
    expect(trackEvent.mock.calls[0]).toHaveLength(1);
  });
});
