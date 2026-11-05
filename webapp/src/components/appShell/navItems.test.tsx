// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { MOBILE_NAV_ITEMS, DESKTOP_NAV_ITEMS } from './navItems';

vi.mock('../../auth/authContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

const sidebar = (therapistMode = false) => render(
  <MemoryRouter initialEntries={['/practice']}>
    <Sidebar
      items={DESKTOP_NAV_ITEMS} therapistMode={therapistMode} userRole="CLIENT" onSwitchMode={vi.fn()}
      therapistClients={[]} needs={[]} ratings={{}} displayName="Григорий" onOpenTracker={vi.fn()} onOpenSettings={vi.fn()}
    />
  </MemoryRouter>,
);

// #925: на компьютере разделы не прячутся в «Ещё», нижняя панель телефона остаётся тремя вкладками.
describe('меню клиента: компьютер и телефон', () => {
  it('слева шесть пунктов в порядке из #925, каждый ведёт в свой раздел', () => {
    sidebar();
    const nav = within(screen.getByRole('navigation'));
    const links = nav.getAllByRole('link');
    expect(links.map(a => a.textContent)).toEqual(['Сегодня', 'Записи', 'Практики', 'Мои паттерны', 'Профиль', 'Ещё']);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/today', '/diary', '/practice', '/schemas', '/profile', '/more']);
    expect(nav.getByText('Практики').closest('a')?.className).toContain('is-active');
  });

  it('режим терапевта: пункты клиента не показываются — меню кабинета прежнее', () => {
    sidebar(true);
    const nav = within(screen.getByRole('navigation'));
    expect(nav.queryByText('Практики')).toBeNull();
    expect(nav.getByText('Все клиенты')).toBeTruthy();
  });

  it('нижняя панель телефона — три пункта: Сегодня, Записи, Ещё', () => {
    render(<MemoryRouter><MobileNav items={MOBILE_NAV_ITEMS} /></MemoryRouter>);
    const links = within(screen.getByRole('navigation')).getAllByRole('link');
    expect(links.map(a => a.textContent)).toEqual(['Сегодня', 'Записи', 'Ещё']);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/today', '/diary', '/more']);
  });
});
