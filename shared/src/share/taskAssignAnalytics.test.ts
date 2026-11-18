import { describe, it, expect, vi } from 'vitest';
import { taskAssignSource, trackTaskAssignSource } from './taskAssignAnalytics';

describe('taskAssignSource', () => {
  it('упражнение — плитка; «Своё задание» — из справочника или свой текст', () => {
    expect(taskAssignSource('safe_place', false)).toBe('tile');
    expect(taskAssignSource('safe_place', true)).toBe('tile');
    expect(taskAssignSource('custom', true)).toBe('catalog');
    expect(taskAssignSource('custom', false)).toBe('custom');
  });

  it('в событие идёт только источник', () => {
    const api = { trackEvent: vi.fn() };
    trackTaskAssignSource(api, 'catalog');
    expect(api.trackEvent).toHaveBeenCalledWith('task_assign_source', {
      source: 'catalog',
    });
  });
});
