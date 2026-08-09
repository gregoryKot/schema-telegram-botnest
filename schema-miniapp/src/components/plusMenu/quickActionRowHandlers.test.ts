// makeQuickActionRowHandlers: handleToggle всегда шлёт quick_action_toggle и
// зовёт onToggle с инвертированным hidden; handleMove шлёт quick_action_move
// ТОЛЬКО когда onMove вернул true (край листа — молча, без события).
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

  it('handleMove: onMove вернул true — шлёт quick_action_move', () => {
    const onMove = vi.fn().mockReturnValue(true);
    const { handleMove } = makeQuickActionRowHandlers('plus', vi.fn(), onMove);
    handleMove('tracker', 'down');
    expect(onMove).toHaveBeenCalledWith('tracker', 'down');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('quick_action_move', {
      action: 'tracker',
      surface: 'plus',
      dir: 'down',
    });
  });

  it('handleMove: onMove вернул false (край) — событие не отправлено', () => {
    const onMove = vi.fn().mockReturnValue(false);
    const { handleMove } = makeQuickActionRowHandlers('plus', vi.fn(), onMove);
    handleMove('tracker', 'up');
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });
});
