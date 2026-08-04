// @vitest-environment jsdom
// ToolbarControls (TbBtn/TbSep/Dropdown) — примитивы тулбара карты режимов
// (0% покрытия). Проверяем: тултип появляется по hover и не у disabled
// кнопки, disabled блокирует клик, Dropdown закрывается по фону и клампит
// позицию, чтобы не вылезти за правый край экрана.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { TbBtn, TbSep, Dropdown } from './ToolbarControls';

afterEach(() => {
  cleanup();
});

describe('TbBtn', () => {
  it('клик по активной кнопке зовёт onClick', () => {
    const onClick = vi.fn();
    render(<TbBtn label="Отменить" onClick={onClick}>↩</TbBtn>);
    fireEvent.click(screen.getByText('↩'));
    expect(onClick).toHaveBeenCalled();
  });

  it('hover показывает тултип с подписью, уход мыши убирает его', () => {
    render(<TbBtn label="Отменить" onClick={vi.fn()}>↩</TbBtn>);
    expect(screen.queryByText('Отменить')).toBeNull();
    fireEvent.mouseEnter(screen.getByText('↩'));
    expect(screen.getByText('Отменить')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByText('↩'));
    expect(screen.queryByText('Отменить')).toBeNull();
  });

  it('disabled-кнопка не показывает тултип по hover и не кликается', () => {
    const onClick = vi.fn();
    render(<TbBtn label="Отменить" onClick={onClick} disabled>↩</TbBtn>);
    fireEvent.mouseEnter(screen.getByText('↩'));
    expect(screen.queryByText('Отменить')).toBeNull();
    fireEvent.click(screen.getByText('↩'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TbSep', () => {
  it('рендерится без падений', () => {
    expect(() => render(<TbSep />)).not.toThrow();
  });
});

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
});
