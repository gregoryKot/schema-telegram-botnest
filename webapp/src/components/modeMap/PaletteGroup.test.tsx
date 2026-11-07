// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PaletteGroup } from './PaletteGroup';

afterEach(() => cleanup());
const draft = { id: 'x', type: 'schema' as const, data: { label: 'S' } };
const base = { id: 'g', title: 'Группа', color: '#123456', total: 2, items: [{ id: 'i', name: 'Пункт', draft: () => draft }], onToggle: vi.fn(), onAdd: vi.fn() };

describe('PaletteGroup', () => {
  it('свёрнута: пунктов нет, счётчик виден; клик зовёт onToggle', () => {
    render(<PaletteGroup {...base} open={false} searching={false} />);
    expect(screen.queryByText('Пункт')).toBeNull();
    expect(screen.getByText('▼ 2')).toBeTruthy();
    fireEvent.click(screen.getByText('Группа'));
    expect(base.onToggle).toHaveBeenCalledWith('g');
  });

  it('при поиске раскрыта и не переключается', () => {
    const onToggle = vi.fn();
    render(<PaletteGroup {...base} onToggle={onToggle} open={false} searching />);
    fireEvent.click(screen.getByText('Группа'));
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByText('Пункт')).toBeTruthy();
  });

  it('клик по пункту добавляет заготовку, перетаскивание кладёт JSON', () => {
    const onAdd = vi.fn();
    render(<PaletteGroup {...base} onAdd={onAdd} open searching={false} />);
    fireEvent.click(screen.getByText('Пункт'));
    expect(onAdd).toHaveBeenCalledWith(draft);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText('Пункт'), { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith('application/modemap-node', JSON.stringify(draft));
  });
});
