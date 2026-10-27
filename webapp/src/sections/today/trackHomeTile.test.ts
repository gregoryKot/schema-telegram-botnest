import { describe, it, expect, vi, beforeEach } from 'vitest';

const trackEvent = vi.fn();
vi.mock('../../api', () => ({ api: { trackEvent: (...a: unknown[]) => trackEvent(...a) } }));

import { trackHomeTile } from './trackHomeTile';

describe('trackHomeTile', () => {
  beforeEach(() => trackEvent.mockReset());

  it('шлёт home_tile с именем плитки и больше ничем', () => {
    trackHomeTile('feed_all');
    expect(trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'feed_all' });
  });
});
