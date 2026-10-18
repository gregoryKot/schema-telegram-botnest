// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

let startParam: string | null = null;
vi.mock('../../../shared/src/host', () => ({
  getHost: () => ({ startParam: () => startParam }),
}));
import { useStartParam } from './useStartParam';

function setup(param: string | null, entry: string, enabled = true) {
  startParam = param;
  const onAction = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
  const view = renderHook(
    ({ on }: { on: boolean }) => {
      useStartParam(on, onAction);
      return useLocation();
    },
    { wrapper, initialProps: { on: enabled } },
  );
  return { onAction, ...view };
}

beforeEach(() => {
  cleanup();
  startParam = null;
});

describe('useStartParam', () => {
  it('pair_ и therapy_ отдают действие присоединения, адрес очищается', () => {
    const a = setup('pair_AB12', '/today?startapp=pair_AB12');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'join', joinKind: 'pair', code: 'AB12' });
    expect(a.result.current.search).toBe('');
    cleanup();
    const b = setup('therapy_XY', '/today?startapp=therapy_XY&x=1');
    expect(b.onAction).toHaveBeenCalledWith({ kind: 'join', joinKind: 'therapy', code: 'XY' });
    expect(b.result.current.search).toBe('?x=1');
  });

  it('diaries ведёт в /diary без вызова onAction', () => {
    const a = setup('diaries', '/today?startapp=diaries');
    expect(a.result.current.pathname).toBe('/diary');
    expect(a.result.current.search).toBe('');
    expect(a.onAction).not.toHaveBeenCalled();
  });

  it('tracker отдаёт действие tracker (параметр из хоста, адрес без параметра не трогаем)', () => {
    const a = setup('tracker', '/today');
    expect(a.onAction).toHaveBeenCalledWith({ kind: 'tracker' });
    expect(a.result.current.pathname).toBe('/today');
  });

  it('неизвестный параметр игнорируется, но из адреса убирается', () => {
    const a = setup('evil', '/today?startapp=evil');
    expect(a.onAction).not.toHaveBeenCalled();
    expect(a.result.current.pathname).toBe('/today');
    expect(a.result.current.search).toBe('');
  });

  it('пока enabled=false ничего не делает; после включения срабатывает один раз', () => {
    const a = setup('tracker', '/today', false);
    expect(a.onAction).not.toHaveBeenCalled();
    a.rerender({ on: true });
    expect(a.onAction).toHaveBeenCalledTimes(1);
    a.rerender({ on: true });
    a.rerender({ on: false });
    a.rerender({ on: true });
    expect(a.onAction).toHaveBeenCalledTimes(1);
  });
});
