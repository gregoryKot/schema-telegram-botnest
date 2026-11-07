import { describe, it, expect, vi } from 'vitest';
import { trackTherapyNudge } from './trackTherapyNudge';

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ api: { trackEvent } }));

describe('trackTherapyNudge', () => {
  it('шлёт therapy_nudge с местом и действием; trigger — только если он есть', () => {
    trackTherapyNudge('home', 'shown');
    expect(trackEvent).toHaveBeenLastCalledWith('therapy_nudge', { place: 'home', action: 'shown' });
    trackTherapyNudge('signal_card', 'dismiss', 'crisis');
    expect(trackEvent).toHaveBeenLastCalledWith('therapy_nudge', { place: 'signal_card', action: 'dismiss', trigger: 'crisis' });
  });
});
