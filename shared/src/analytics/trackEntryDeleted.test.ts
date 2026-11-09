import { describe, it, expect, vi } from 'vitest';
import { trackEntryDeleted } from './trackEntryDeleted';

describe('trackEntryDeleted', () => {
  it('шлёт entry_deleted с типом записи', () => {
    const api = { trackEvent: vi.fn() };
    trackEntryDeleted(api, 'phrase_check');
    expect(api.trackEvent).toHaveBeenCalledWith('entry_deleted', {
      type: 'phrase_check',
    });
  });

  it('сбой трекинга не всплывает — удаление уже прошло', () => {
    const api = {
      trackEvent: vi.fn(() => {
        throw new Error('offline');
      }),
    };
    expect(() => trackEntryDeleted(api, 'diary')).not.toThrow();
  });
});
