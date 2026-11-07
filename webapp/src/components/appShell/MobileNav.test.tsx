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

  // C-З8: на «Практиках», «Паттернах» и «Профиле» не горел ни один пункт.
  it.each(['/practice', '/schemas', '/profile', '/more'])('клиент на %s: горит «Ещё», остальные нет', (path) => {
    render(<MemoryRouter initialEntries={[path]}><MobileNav items={ITEMS} /></MemoryRouter>);
    const more = screen.getByText('Ещё').closest('a')!;
    expect(more.className).toContain('active');
    expect(more.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Сегодня').closest('a')?.className).not.toContain('active');
    expect(screen.getByText('Записи').closest('a')?.className).not.toContain('active');
  });

  it('терапевт: свои пункты кабинета вместо разделов клиента', () => {
    render(<MemoryRouter initialEntries={['/cabinet']}><MobileNav items={ITEMS} therapist /></MemoryRouter>);
    expect(screen.getByText('Клиенты').closest('a')?.getAttribute('href')).toBe('/cabinet');
    expect(screen.getByText('Сегодня').closest('a')?.getAttribute('href')).toBe('/cabinet/today');
    expect(screen.queryByText('Записи')).toBeNull();
    expect(screen.getByText('Клиенты').closest('a')?.className).toContain('active');
    // без onProfile «Профиль» — ссылка на страницу аккаунта, как до #902
    expect(screen.getByText('Профиль').closest('a')?.getAttribute('href')).toBe('/account');
  });

  it.each([['/cabinet', true], ['/cabinet/tasks', true], ['/cabinet/abcdefgh', false], ['/cabinet/today', false]])(
    'терапевт на %s: «Клиенты» горит — %s (доска «Задания» — вкладка списка)', (path, on) => {
      render(<MemoryRouter initialEntries={[path]}><MobileNav items={ITEMS} therapist /></MemoryRouter>);
      const clients = screen.getByText('Клиенты').closest('a')!;
      expect(clients.className.includes('active')).toBe(on);
      expect(clients.getAttribute('aria-current')).toBe(on ? 'page' : null);
    });

  // «Справочник» терапевта (#995): свой раздел /cabinet/guide, горит только на нём.
  it.each([['/cabinet/guide', true], ['/cabinet', false], ['/cabinet/today', false]])(
    'терапевт на %s: «Справочник» ведёт в /cabinet/guide, горит — %s', (path, on) => {
      render(<MemoryRouter initialEntries={[path]}><MobileNav items={ITEMS} therapist /></MemoryRouter>);
      const guide = screen.getByText('Справочник').closest('a')!;
      expect(guide.getAttribute('href')).toBe('/cabinet/guide');
      expect(guide.className.includes('active')).toBe(on);
      expect(screen.getByText('Клиенты').closest('a')!.className.includes('active')).toBe(path === '/cabinet');
    });

  it('клиент: «Справочника» в его панели нет', () => {
    render(<MemoryRouter><MobileNav items={ITEMS} /></MemoryRouter>);
    expect(screen.queryByText('Справочник')).toBeNull();
  });

  it('терапевт: «Поиск» открывает палитру команд', () => {
    const onSearch = vi.fn();
    render(<MemoryRouter><MobileNav items={ITEMS} therapist onSearch={onSearch} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Поиск'));
    expect(onSearch).toHaveBeenCalledOnce();
  });

  // #902: лист настроек — единственное место с переключателем режима, а сайдбар
  // на телефоне скрыт; со ссылкой на /account из кабинета в режим клиента не вернуться.
  it('терапевт: «Профиль» открывает настройки — кнопка, ссылки на /account нет', () => {
    const onProfile = vi.fn();
    const { container } = render(<MemoryRouter><MobileNav items={ITEMS} therapist onProfile={onProfile} /></MemoryRouter>);
    const profile = screen.getByText('Профиль');
    expect(profile.closest('button')).not.toBeNull();
    expect(profile.closest('a')).toBeNull();
    expect(container.querySelector('a[href="/account"]')).toBeNull();
    fireEvent.click(profile);
    expect(onProfile).toHaveBeenCalledOnce();
    // порядок и состав пунктов от onProfile не зависят
    expect(Array.from(container.querySelectorAll('.mobile-nav-item')).map(n => n.textContent))
      .toEqual(['Сегодня', 'Клиенты', 'Справочник', 'Поиск', 'Профиль']);
  });

  it('клиент: onProfile раздел «Профиль» в его панель не добавляет', () => {
    render(<MemoryRouter><MobileNav items={ITEMS} onProfile={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByText('Профиль')).toBeNull();
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
