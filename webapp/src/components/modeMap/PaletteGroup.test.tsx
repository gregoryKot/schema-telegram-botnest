// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaletteGroup } from './PaletteGroup';
import type { CatalogGroup } from './paletteModel';

const draft = { id: 'x', type: 'schema' as const, data: { label: 'S' } };
const group: CatalogGroup = {
  id: 'g', title: 'Группа', hint: 'Группа полностью', total: 2,
  items: [{ id: 'i', name: 'Пункт', hint: 'что это', mark: 'mode', sign: 'looming', color: 'var(--c-teal)', draft: () => draft }],
};
const base = { group, art: <svg data-testid="art" />, onToggle: vi.fn(), onAdd: vi.fn() };

describe('PaletteGroup', () => {
  it('свёрнута: пунктов нет, тихое число и шеврон; клик зовёт onToggle с id группы', () => {
    const onToggle = vi.fn();
    render(<PaletteGroup {...base} onToggle={onToggle} open={false} />);
    expect(screen.queryByText('Пункт')).toBeNull();
    const head = screen.getByRole('button', { name: /Группа/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.querySelector('.mm2-pal-head-n')?.textContent).toBe('2');
    expect(head.textContent).not.toContain('▼');
    expect(head.getAttribute('title')).toBe('Группа полностью');
    fireEvent.click(head);
    expect(onToggle).toHaveBeenCalledWith('g');
  });

  it('знак группы — в колонке знака заголовка; строка — маленький знак группы 24×14, имя и подсказка', () => {
    const { container } = render(<PaletteGroup {...base} open />);
    expect(container.querySelector('.mm2-pal-head .mm2-pal-mark [data-testid="art"]')).not.toBeNull();
    const row = screen.getByText('Пункт').closest('button')!;
    expect(row.querySelector('.mm2-pal-mark svg.pp-art--nav')).not.toBeNull();
    expect(row.getAttribute('title')).toBe('Пункт — что это');
  });

  it('клик по пункту добавляет заготовку, перетаскивание кладёт JSON', () => {
    const onAdd = vi.fn();
    render(<PaletteGroup {...base} onAdd={onAdd} open />);
    fireEvent.click(screen.getByText('Пункт'));
    expect(onAdd).toHaveBeenCalledWith(draft);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText('Пункт'), { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith('application/modemap-node', JSON.stringify(draft));
  });
});
