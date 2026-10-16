// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileNav } from './MobileNav';

const ITEMS = [{ id: 'today' as const, label: 'Сегодня' }, { id: 'diary' as const, label: 'Дневник' }];

describe('MobileNav', () => {
  it('клиент: пункты разделов ведут в свои разделы', () => {
    render(<MemoryRouter><MobileNav items={ITEMS} /></MemoryRouter>);
    expect(screen.getByText('Дневник').closest('a')?.getAttribute('href')).toBe('/diary');
    expect(screen.queryByText('Клиенты')).toBeNull();
  });

  it('терапевт: свои пункты кабинета вместо разделов клиента', () => {
    render(<MemoryRouter initialEntries={['/cabinet']}><MobileNav items={ITEMS} therapist /></MemoryRouter>);
    expect(screen.getByText('Клиенты').closest('a')?.getAttribute('href')).toBe('/cabinet');
    expect(screen.getByText('Сегодня').closest('a')?.getAttribute('href')).toBe('/cabinet/today');
    expect(screen.queryByText('Дневник')).toBeNull();
    expect(screen.getByText('Клиенты').closest('a')?.className).toContain('active');
  });

  it('терапевт: «Поиск» открывает палитру команд', () => {
    const onSearch = vi.fn();
    render(<MemoryRouter><MobileNav items={ITEMS} therapist onSearch={onSearch} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Поиск'));
    expect(onSearch).toHaveBeenCalledOnce();
  });
});
