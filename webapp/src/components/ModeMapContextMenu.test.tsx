// @vitest-environment jsdom
// ModeMapContextMenu — контекстное меню правого клика на карте режимов
// (0% покрытия). Проверяем: пункты рендерятся, клик по пункту выполняет
// действие И закрывает меню, клик по фону и правый клик по фону тоже закрывают.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeMapContextMenu } from './ModeMapContextMenu';

afterEach(() => {
  cleanup();
});

describe('ModeMapContextMenu', () => {
  it('рендерит все пункты меню', () => {
    render(<ModeMapContextMenu x={10} y={20} items={[
      { label: 'Переименовать', onClick: vi.fn() },
      { label: 'Удалить', onClick: vi.fn(), danger: true },
    ]} onClose={vi.fn()} />);
    expect(screen.getByText('Переименовать')).toBeTruthy();
    expect(screen.getByText('Удалить')).toBeTruthy();
  });

  it('клик по пункту вызывает его onClick и закрывает меню', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(<ModeMapContextMenu x={0} y={0} items={[{ label: 'Удалить', onClick }]} onClose={onClose} />);
    fireEvent.click(screen.getByText('Удалить'));
    expect(onClick).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('клик по фону закрывает меню, не вызывая пункты', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(<ModeMapContextMenu x={0} y={0} items={[{ label: 'Удалить', onClick }]} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('повторный правый клик по фону тоже закрывает меню (не открывает браузерное контекстное)', () => {
    const onClose = vi.fn();
    render(<ModeMapContextMenu x={0} y={0} items={[]} onClose={onClose} />);
    fireEvent.contextMenu(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });
});
