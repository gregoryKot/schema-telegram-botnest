// @vitest-environment jsdom
// ToolbarControls (TbBtn/TbSep) — примитивы тулбара карты режимов. Проверяем:
// тултип появляется по hover и не у disabled кнопки, disabled блокирует клик.
// Выпадающее меню — общий components/Dropdown, его тесты рядом с ним.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TbBtn, TbSep } from './ToolbarControls';

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
