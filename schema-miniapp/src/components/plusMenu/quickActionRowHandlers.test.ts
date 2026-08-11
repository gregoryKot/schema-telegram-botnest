// makeQuickActionRowHandlers: handleToggle всегда шлёт quick_action_toggle и
// зовёт onToggle с инвертированным hidden; handleReorder шлёт
// quick_action_move ТОЛЬКО когда onReorder вернул 'up'/'down' (truthy) — с
// этим же dir в meta; false (no-op) — молча.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeQuickActionRowHandlers } from './quickActionRowHandlers';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => vi.clearAllMocks());

describe('makeQuickActionRowHandlers', () => {
  it('handleToggle(id, false) скрывает: событие hidden:true + onToggle(id, true)', () => {
    const onToggle = vi.fn();
    const { handleToggle } = makeQuickActionRowHandlers(
      'plus',
      onToggle,
      vi.fn(),
    );
    handleToggle('warm_words', false);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_toggle', {
      action: 'warm_words',
      hidden: true,
      surface: 'plus',
    });
    expect(onToggle).toHaveBeenCalledWith('warm_words', true);
  });

  it('handleToggle(id, true) возвращает: событие hidden:false', () => {
    const onToggle = vi.fn();
    const { handleToggle } = makeQuickActionRowHandlers(
      'tools',
      onToggle,
      vi.fn(),
    );
    handleToggle('warm_words', true);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_toggle', {
      action: 'warm_words',
      hidden: false,
      surface: 'tools',
    });
  });

  it('handleReorder: onReorder вернул "down" — шлёт quick_action_move с dir="down"', () => {
    const onReorder = vi.fn().mockReturnValue('down');
    const { handleReorder } = makeQuickActionRowHandlers(
      'plus',
      vi.fn(),
      onReorder,
    );
    handleReorder('tracker', 2);
    expect(onReorder).toHaveBeenCalledWith('tracker', 2);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_move', {
      action: 'tracker',
      surface: 'plus',
      dir: 'down',
    });
  });

  it('handleReorder: onReorder вернул "up" — шлёт quick_action_move с dir="up"', () => {
    const onReorder = vi.fn().mockReturnValue('up');
    const { handleReorder } = makeQuickActionRowHandlers(
      'tools',
      vi.fn(),
      onReorder,
    );
    handleReorder('tracker', 0);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_move', {
      action: 'tracker',
      surface: 'tools',
      dir: 'up',
    });
  });

  it('handleReorder: onReorder вернул false (no-op/край группы) — событие не отправлено', () => {
    const onReorder = vi.fn().mockReturnValue(false);
    const { handleReorder } = makeQuickActionRowHandlers(
      'plus',
      vi.fn(),
      onReorder,
    );
    handleReorder('tracker', 0);
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });
});
