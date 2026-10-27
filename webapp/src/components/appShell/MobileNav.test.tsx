// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileNav } from './MobileNav';

const ITEMS = [
  { id: 'today' as const, label: 'Сегодня' },
  { id: 'diary' as const, label: 'Записи' },
  { id: 'more' as const, label: 'Ещё' },
];

describe('MobileNav', () => {
  it('клиент: пункты разделов ведут в свои разделы', () => {
    render(<MemoryRouter><MobileNav items={ITEMS} /></MemoryRouter>);
    expect(screen.getByText('Записи').closest('a')?.getAttribute('href')).toBe('/diary');
    expect(screen.getByText('Ещё').closest('a')?.getAttribute('href')).toBe('/more');
    expect(screen.queryByText('Клиенты')).toBeNull();
  });

  it('терапевт: свои пункты кабинета вместо разделов клиента', () => {
    render(<MemoryRouter initialEntries={['/cabinet']}><MobileNav items={ITEMS} therapist /></MemoryRouter>);
    expect(screen.getByText('Клиенты').closest('a')?.getAttribute('href')).toBe('/cabinet');
    expect(screen.getByText('Сегодня').closest('a')?.getAttribute('href')).toBe('/cabinet/today');
    expect(screen.queryByText('Записи')).toBeNull();
    expect(screen.getByText('Клиенты').closest('a')?.className).toContain('active');
  });

  it('терапевт: «Поиск» открывает палитру команд', () => {
    const onSearch = vi.fn();
    render(<MemoryRouter><MobileNav items={ITEMS} therapist onSearch={onSearch} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Поиск'));
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('над экранной клавиатурой панель скрыта, после ухода из поля вернулась', () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('pointer: coarse'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const { container } = render(<MemoryRouter><MobileNav items={ITEMS} /><textarea aria-label="поле" /></MemoryRouter>);
    expect(container.querySelector('.mobile-nav')).not.toBeNull();
    act(() => { screen.getByLabelText('поле').focus(); });
    expect(container.querySelector('.mobile-nav')).toBeNull();
    act(() => { screen.getByLabelText('поле').blur(); });
    expect(container.querySelector('.mobile-nav')).not.toBeNull();
  });
});
