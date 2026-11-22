import { describe, it, expect, vi } from 'vitest';
import { taskAssignSource, trackTaskAssignSource } from './taskAssignAnalytics';

describe('taskAssignSource', () => {
  it('упражнение — плитка; «Своё задание» — из справочника или свой текст', () => {
    expect(taskAssignSource('safe_place', false)).toBe('tile');
    expect(taskAssignSource('safe_place', true)).toBe('tile');
    expect(taskAssignSource('custom', true)).toBe('catalog');
    expect(taskAssignSource('custom', false)).toBe('custom');
  });

  it('лист открыт с заготовкой — источник её, пока тип не сменили', () => {
    const guide = { origin: 'guide', type: 'custom' } as const;
    expect(taskAssignSource('custom', true, guide)).toBe('guide');
    expect(taskAssignSource('safe_place', false, guide)).toBe('tile');
    const template = { origin: 'template', type: 'safe_place' } as const;
    expect(taskAssignSource('safe_place', false, template)).toBe('template');
    expect(taskAssignSource('custom', false, template)).toBe('custom');
    expect(taskAssignSource('custom', true, { type: 'custom' })).toBe(
      'catalog',
    );
  });

  it('в событие идёт только источник', () => {
    const api = { trackEvent: vi.fn() };
    trackTaskAssignSource(api, 'catalog');
    expect(api.trackEvent).toHaveBeenCalledWith('task_assign_source', {
      source: 'catalog',
    });
  });
});
