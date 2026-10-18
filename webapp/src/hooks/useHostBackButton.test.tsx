// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useHostBackButton } from './useHostBackButton';
import { pushSheetState } from './historySheetStack';
import { installTelegram, removeTelegram } from '../host/tgStub.test-helpers';

function stubBackButton() {
  let click: (() => void) | null = null;
  const bb = {
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn((fn: () => void) => {
      click = fn;
    }),
    offClick: vi.fn(),
  };
  installTelegram({ BackButton: bb });
  return { bb, press: () => click?.() };
}

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/today']}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      useHostBackButton();
      return { nav: useNavigate(), loc: useLocation() };
    },
    { wrapper },
  );
}

beforeEach(() => removeTelegram());
afterEach(() => {
  removeTelegram();
  cleanup();
});

describe('useHostBackButton', () => {
  it('в браузере ничего не делает и не падает', () => {
    expect(() => setup()).not.toThrow();
  });

  it('пока листов нет — кнопка скрыта', () => {
    const { bb } = stubBackButton();
    setup();
    expect(bb.show).not.toHaveBeenCalled();
    expect(bb.hide).toHaveBeenCalled();
  });

  it('открыт лист — показана, лист закрылся — скрыта', () => {
    const { bb } = stubBackButton();
    const view = setup();
    act(() => {
      view.result.current.nav('/today', {
        state: pushSheetState(view.result.current.loc.state, 'a'),
      });
    });
    expect(bb.show).toHaveBeenCalledTimes(1);
    bb.hide.mockClear();
    act(() => view.result.current.nav(-1));
    expect(bb.hide).toHaveBeenCalled();
  });

  it('нажатие — шаг назад по истории (navigate(-1))', () => {
    const { press } = stubBackButton();
    const view = setup();
    act(() => {
      view.result.current.nav('/today', { state: pushSheetState(null, 'a') });
    });
    expect(view.result.current.loc.state).not.toBeNull();
    act(() => press());
    expect(view.result.current.loc.state).toBeNull();
  });

  it('при размонтировании отписывается и прячет кнопку', () => {
    const { bb } = stubBackButton();
    const view = setup();
    bb.hide.mockClear();
    view.unmount();
    expect(bb.offClick).toHaveBeenCalled();
    expect(bb.hide).toHaveBeenCalled();
  });
});
