// @vitest-environment jsdom
// Dropdown — выпадающее меню у кнопки (тулбар карты режимов, меню «⋯ Ещё»
// концептуализации). Проверяем: закрывается по фону и Escape (фокус возвращается
// кнопке-якорю), не падает без якоря, в режиме role="menu" фокус уходит на первый
// пункт и стрелки ходят по пунктам по кругу, минуя disabled.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { Dropdown } from './Dropdown';

afterEach(() => {
  cleanup();
});

function renderMenu(onClose = vi.fn()) {
  const ref = createRef<HTMLDivElement>();
  render(
    <div>
      <div ref={ref}><button type="button">Якорь</button></div>
      <Dropdown onClose={onClose} anchorRef={ref} role="menu" label="Ещё действия">
        <button type="button" role="menuitem">Первый</button>
        <button type="button" role="menuitem" disabled>Занят</button>
        <button type="button" role="menuitem">Третий</button>
      </Dropdown>
    </div>,
  );
  return onClose;
}

describe('Dropdown', () => {
  it('клик по фону зовёт onClose', () => {
    const onClose = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <Dropdown onClose={onClose} anchorRef={ref}><span>Пункт</span></Dropdown>
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });

  it('без anchorRef.current не падает (не позиционируется, но не крашится)', () => {
    const ref = createRef<HTMLDivElement>();
    expect(() =>
      render(<Dropdown onClose={vi.fn()} anchorRef={ref}><span>Пункт</span></Dropdown>),
    ).not.toThrow();
  });

  it('рендерит переданный контент, когда anchor существует', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <Dropdown onClose={vi.fn()} anchorRef={ref}><span>Пункт меню</span></Dropdown>
      </div>,
    );
    expect(screen.getByText('Пункт меню')).toBeTruthy();
  });

  it('Escape зовёт onClose и возвращает фокус кнопке-якорю', () => {
    const onClose = renderMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Якорь' }));
  });

  it('role="menu": контейнер подписан, фокус на первом пункте', () => {
    renderMenu();
    expect(screen.getByRole('menu', { name: 'Ещё действия' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Первый' }));
  });

  it('стрелки ходят по пунктам по кругу, пропуская disabled', () => {
    renderMenu();
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Третий' }));
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Первый' }));
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Третий' }));
  });
});
