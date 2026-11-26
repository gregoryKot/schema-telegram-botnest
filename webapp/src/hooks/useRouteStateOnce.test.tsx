// @vitest-environment jsdom
// Состояние маршрута исполняется один раз: обработчик зовётся после очистки состояния, повторный
// рендер и чужое состояние его не зовут, новый переход с состоянием — зовёт снова.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useRouteStateOnce } from './useRouteStateOnce';

const parse = (state: unknown): string | null => {
  const open = (state as { open?: unknown } | null)?.open;
  return typeof open === 'string' ? open : null;
};

function Probe({ handle }: { handle: (target: string) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  useRouteStateOnce(parse, handle, (target) => target);
  return (
    <>
      <output data-testid="state">{location.pathname} {JSON.stringify(location.state)}</output>
      {['/b', '/c'].map((to) => <button key={to} onClick={() => { void navigate(to, { state: { open: 'y' } }); }}>{to}</button>)}
    </>
  );
}

const renderAt = (state: unknown, handle = vi.fn()) => {
  const view = render(<MemoryRouter initialEntries={[{ pathname: '/a', state }]}><Probe handle={handle} /></MemoryRouter>);
  return { handle, view };
};

afterEach(cleanup);

describe('useRouteStateOnce', () => {
  it('цель из состояния исполняется один раз, состояние очищено, адрес прежний', () => {
    const { handle, view } = renderAt({ open: 'x' });
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith('x');
    expect(screen.getByTestId('state').textContent).toBe('/a null');
    view.rerender(<MemoryRouter><Probe handle={handle} /></MemoryRouter>);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('без состояния и с чужим состоянием обработчик не зовётся, чужое состояние остаётся', () => {
    expect(renderAt(null).handle).not.toHaveBeenCalled();
    cleanup();
    expect(renderAt({ other: 1 }).handle).not.toHaveBeenCalled();
    expect(screen.getByTestId('state').textContent).toBe('/a {"other":1}');
  });

  it('новый переход с состоянием исполняется снова — на новом адресе', () => {
    const { handle } = renderAt(null);
    fireEvent.click(screen.getByText('/b'));
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith('y');
    expect(screen.getByTestId('state').textContent).toBe('/b null');
    fireEvent.click(screen.getByText('/c'));
    expect(handle).toHaveBeenCalledTimes(2);
  });
});
