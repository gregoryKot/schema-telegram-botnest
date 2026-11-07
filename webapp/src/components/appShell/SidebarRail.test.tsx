// @vitest-environment jsdom
// Сворачиваемое боковое меню на компьютере (владелец 2026-11: «боковую панель хочется
// скрывать» — на ноутбуке меню и панель режимов съедали ~640px у холста карт). Свёрнутое —
// полоска с иконками; у иконок подпись в aria-label и title; выбор запоминается на устройстве.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SidebarSkeleton } from './SidebarRail';
import { DESKTOP_NAV_ITEMS } from './navItems';
import { SIDEBAR_COLLAPSED_KEY, setSidebarCollapsed } from './sidebarCollapse';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
vi.mock('../../auth/authContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

// Сначала размонтировать, потом развернуть: без подписчиков смена не требует act.
afterEach(() => { cleanup(); setSidebarCollapsed(false); localStorage.clear(); });

function renderSidebar({ therapist = false, path = '/today' } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar items={DESKTOP_NAV_ITEMS} therapistMode={therapist} userRole={therapist ? 'THERAPIST' : 'CLIENT'}
               onSwitchMode={vi.fn()} therapistClients={[]} needs={[]} ratings={{}} displayName="Григорий"
               onOpenTracker={vi.fn()} onOpenSettings={vi.fn()} />
    </MemoryRouter>,
  );
}
const aside = () => document.querySelector('aside.sidebar')!;
const navLinks = () => within(screen.getByRole('navigation')).getAllByRole('link');

describe('боковое меню — свернуть и развернуть', () => {
  it('развёрнутое: знак и название в шапке, кнопка «Свернуть меню» там же, подписи пунктов текстом', () => {
    renderSidebar();
    const toggle = screen.getByRole('button', { name: 'Свернуть меню' });
    const brand = toggle.closest('.sb-brand')!;
    expect(brand.querySelector('svg[data-brand-mark="full"]')).toBeTruthy();
    expect(brand.textContent).toBe('Всё по схеме'); // без буквы «В» прежнего квадрата
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(aside().classList.contains('is-collapsed')).toBe(false);
    expect(navLinks().map((a) => a.textContent)).toEqual(DESKTOP_NAV_ITEMS.map((i) => i.label));
  });

  it('свернуть → полоска с иконками; развернуть → прежнее меню', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));
    expect(aside().classList.contains('is-collapsed')).toBe(true);
    expect(screen.queryByText('Всё по схеме')).toBeNull();
    // Знак остаётся наверху полоски, над шевроном.
    const head = aside().querySelector('.sb-rail-head')!;
    expect(head.firstElementChild!.querySelector('[data-brand-mark]')!.getAttribute('data-brand-mark')).toBe('full');
    expect(head.lastElementChild!.getAttribute('aria-label')).toBe('Развернуть меню');
    expect(screen.queryByRole('button', { name: 'Выйти' })).toBeNull();
    const expand = screen.getByRole('button', { name: 'Развернуть меню' });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(expand);
    expect(aside().classList.contains('is-collapsed')).toBe(false);
    expect(screen.getByText('Всё по схеме')).toBeTruthy();
  });

  it('клиент: у каждой иконки подпись в aria-label и title, пути и порядок — как в развёрнутом', () => {
    renderSidebar({ path: '/practice' });
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));
    const links = navLinks();
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(DESKTOP_NAV_ITEMS.map((i) => i.label));
    expect(links.map((a) => a.getAttribute('title'))).toEqual(DESKTOP_NAV_ITEMS.map((i) => i.label));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(DESKTOP_NAV_ITEMS.map((i) => '/' + i.id));
    expect(links.every((a) => a.querySelector('svg') && a.textContent === '')).toBe(true);
    expect(screen.getByRole('link', { name: 'Практики' }).className).toContain('is-active');
    expect(screen.getByRole('link', { name: 'Григорий' }).getAttribute('href')).toBe('/profile');
  });

  it('терапевт: Сегодня, Справочник, Все клиенты; «Все клиенты» горит на списке', () => {
    renderSidebar({ therapist: true, path: '/cabinet/tasks' });
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));
    expect(navLinks().map((a) => a.getAttribute('aria-label'))).toEqual(['Сегодня', 'Справочник', 'Все клиенты']);
    expect(navLinks().map((a) => a.getAttribute('href'))).toEqual(['/cabinet/today', '/cabinet/guide', '/cabinet']);
    const all = screen.getByRole('link', { name: 'Все клиенты' });
    expect(all.getAttribute('aria-current')).toBe('page');
    expect(all.getAttribute('title')).toBe('Все клиенты');
  });

  it('запоминается на устройстве: ключ в localStorage, после перерисовки меню снова свёрнуто', () => {
    const first = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
    first.unmount();
    renderSidebar({ therapist: true, path: '/cabinet' }); // меню общее у клиента и терапевта
    expect(aside().classList.contains('is-collapsed')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Развернуть меню' }));
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
  });

  it('силуэт загрузки повторяет выбор: свёрнутое меню — сразу полоской', () => {
    const { container, unmount } = render(<SidebarSkeleton />);
    expect(container.querySelector('aside.sidebar.is-collapsed')).toBeNull();
    expect(container.querySelector('.sb-brand [data-brand-mark]')).toBeTruthy();
    unmount();
    act(() => setSidebarCollapsed(true));
    const rail = render(<SidebarSkeleton />).container;
    expect(rail.querySelector('aside.sidebar.is-collapsed')).toBeTruthy();
    expect(rail.querySelector('.sb-brand')).toBeNull();
    expect(rail.querySelector('.sb-rail-head [data-brand-mark]')).toBeTruthy();
    expect(rail.querySelector('a')).toBeNull(); // в силуэте знак — не ссылка
  });
});

// Владелец 2026-11: «логотип должен кидать на главную». Главная раздела — «Сегодня»:
// у клиента /today, в режиме терапевта — /cabinet/today.
describe('знак меню ведёт на главную раздела', () => {
  function Where() { return <output data-testid="where">{useLocation().pathname}</output>; }
  function renderAt(therapist: boolean, path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Sidebar items={DESKTOP_NAV_ITEMS} therapistMode={therapist} userRole={therapist ? 'THERAPIST' : 'CLIENT'}
                 onSwitchMode={vi.fn()} therapistClients={[]} needs={[]} ratings={{}} displayName="Григорий"
                 onOpenTracker={vi.fn()} onOpenSettings={vi.fn()} />
        <Where />
      </MemoryRouter>,
    );
  }
  const home = () => screen.getByRole('link', { name: 'На главную' });

  it.each([[false, '/diary', '/today'], [true, '/cabinet/guide', '/cabinet/today']])(
    'терапевт=%s: с %s тап по знаку → %s, и в развёрнутом, и в свёрнутом меню', (therapist, from, to) => {
      renderAt(therapist, from);
      expect(home().closest('.sb-brand')!.textContent).toBe('Всё по схеме');
      fireEvent.click(home());
      expect(screen.getByTestId('where').textContent).toBe(to);
      fireEvent.click(screen.getByRole('button', { name: 'Свернуть меню' }));
      expect(home().closest('.sb-rail-head')).toBeTruthy();
      expect(home().getAttribute('href')).toBe(to);
    });
});
