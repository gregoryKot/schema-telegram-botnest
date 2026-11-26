// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api', () => ({ api: { trackPublicEvent: vi.fn() } }));
import { api } from '../../api';
import { useGameArrival } from './useGameArrival';

const track = vi.mocked(api.trackPublicEvent);

describe('useGameArrival', () => {
  beforeEach(() => track.mockClear());

  it('?from=game: шлёт game_app_arrive и убирает метку, остальное в адресе остаётся', () => {
    window.history.replaceState(null, '', '/?from=game&utm_source=x#faq');
    renderHook(() => useGameArrival());
    expect(track).toHaveBeenCalledWith('game_app_arrive');
    expect(window.location.search).toBe('?utm_source=x');
    expect(window.location.hash).toBe('#faq');
  });

  it('повторный рендер после снятия метки не шлёт второй раз', () => {
    window.history.replaceState(null, '', '/?from=game');
    renderHook(() => useGameArrival());
    renderHook(() => useGameArrival());
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('другая метка from (мост к терапевту) — молчит и адрес не трогает', () => {
    window.history.replaceState(null, '', '/?from=app_today');
    renderHook(() => useGameArrival());
    expect(track).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?from=app_today');
  });
});
