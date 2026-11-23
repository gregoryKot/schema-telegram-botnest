// @vitest-environment jsdom
// Блок «Связано» листа справочника: пустые группы не рисуются, без групп нет блока; чип несёт оттенок листа,
// куда ведёт, а тап по чипу открывает лист и не подсвечивает раздел.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GuideRelated, type RelatedGroup } from './GuideRelated';

const look = (id: string) => (id === 'a' ? { hue: 145 } : null) as ReturnType<RelatedGroup['look']>;
const group = (over: Partial<RelatedGroup>): RelatedGroup => ({
  title: 'Схемы', address: 'schema:x/modeIds', items: [{ id: 'a', name: 'Альфа' }, { id: 'b', name: 'Бета' }], look, ...over,
});

describe('GuideRelated', () => {
  it('пустая группа не рисуется; без непустых групп нет и блока', () => {
    const { container } = render(<GuideRelated groups={[group({ items: [] })]} />);
    expect(container.innerHTML).toBe('');
  });

  it('группы — разделы внутри «Связано»; чип с оттенком листа, без оттенка — без стиля', () => {
    render(<GuideRelated groups={[group({ onOpen: vi.fn() }), group({ title: 'Режимы', items: [] })]} />);
    const block = within(screen.getByRole('region', { name: 'Связано' }));
    expect(block.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Схемы']);
    const [alpha, beta] = block.getAllByRole('button');
    expect(alpha.style.getPropertyValue('--h')).toBe('145');
    expect(beta.getAttribute('style')).toBeNull();
  });

  it('тап по чипу открывает лист и не всплывает к разделу', () => {
    const onOpen = vi.fn();
    const onSection = vi.fn();
    render(<div onClick={onSection}><GuideRelated groups={[group({ onOpen })]} /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Бета' }));
    expect(onOpen).toHaveBeenCalledWith('b');
    expect(onSection).not.toHaveBeenCalled();
  });

  it('без перехода — названия строкой, без кнопок', () => {
    render(<GuideRelated groups={[group({})]} />);
    expect(screen.getByText('Альфа, Бета')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
