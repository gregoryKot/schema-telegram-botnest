// @vitest-environment jsdom
// Сайдбар кабинета и «Показ экрана»: при включённом режиме на экране нет ни имён клиентов,
// ни их числа у «Все клиенты» — терапевт показывает экран клиенту, и тот не видит, кто ещё
// ходит к этому терапевту. Тумблер, поиск и ссылки — SidebarClients/ScreenShareSwitch.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TherapyClientSummary } from '../../api';
import { Sidebar } from './Sidebar';
import { setScreenShare } from './screenShareMode';
import { CABINET_SCREEN_SHARE_ON_EVENT } from '../../../../shared/src/share/analytics';

const trackEvent = vi.fn();
vi.mock('../../api', () => ({ api: { trackEvent: (...a: unknown[]) => trackEvent(...a), getTasks: vi.fn().mockResolvedValue([]) }, reportClientError: vi.fn() }));
vi.mock('../../auth/authContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

// Сначала размонтировать, потом выключить: без подписчиков смена режима не требует act.
afterEach(() => { cleanup(); setScreenShare(false); trackEvent.mockClear(); });

const NAMES = ['Анна Крылова', 'Борис', 'Вера', 'Глеб', 'Дина'];
const clients: TherapyClientSummary[] = NAMES.map((name, i) => ({
  telegramId: i + 1, name, clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
  recentIndexHistory: [], relationCreatedAt: '2026-01-01T00:00:00Z', therapyStartDate: null,
  nextSession: null, meetingDays: [], schemaIds: [],
}));

function renderSidebar(path = '/cabinet/1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar items={[]} therapistMode userRole="THERAPIST" onSwitchMode={vi.fn()} therapistClients={clients}
               needs={[]} ratings={{}} displayName="Григорий" onOpenTracker={vi.fn()} onOpenSettings={vi.fn()} />
    </MemoryRouter>,
  );
}
const badge = () => screen.getByText('Все клиенты').closest('a')!.querySelector('.badge')!.textContent;
const toggle = () => screen.getByRole('switch', { name: /Показ экрана/ });
const visibleNames = (root: HTMLElement) => NAMES.filter((n) => root.textContent!.includes(n));

// Решение 9 (docs/design/APP_2026-11.md): у доски «Задания» свой пункт меню — «Все клиенты» горит на списке.
describe('Sidebar — «Все клиенты» и «Задания»', () => {
  it.each([['/cabinet', true, false], ['/cabinet/tasks', false, true], ['/cabinet/1', false, false], ['/cabinet/today', false, false]])(
    '%s: «Все клиенты» — %s, «Задания» — %s', (path, all, tasks) => {
      renderSidebar(path);
      const a = screen.getByText('Все клиенты').closest('a')!;
      expect(a.className.includes('is-active')).toBe(all);
      expect(a.getAttribute('aria-current')).toBe(all ? 'page' : null);
      const t = screen.getByText('Задания').closest('a')!;
      expect(t.getAttribute('href')).toBe('/cabinet/tasks');
      expect(t.className.includes('is-active')).toBe(tasks);
    });

  it('у каждого пункта меню — знак раздела, а не цветная точка', () => {
    renderSidebar('/cabinet');
    const items = Array.from(document.querySelectorAll('.sb-nav > .sb-item'));
    expect(items.length).toBe(4);
    expect(items.every((n) => n.querySelector('svg.pp-art--nav'))).toBe(true);
    expect(document.querySelector('.sb-dot')).toBeNull();
  });
});

// «Справочник» терапевта (#995): пункт меню до клиентов — их список под «Все клиенты» бывает длинным.
describe('Sidebar — «Справочник»', () => {
  it.each([['/cabinet/guide', true], ['/cabinet', false]])('%s: пункт ведёт в /cabinet/guide, горит — %s', (path, on) => {
    renderSidebar(path);
    const guide = screen.getByText('Справочник').closest('a')!;
    expect(guide.getAttribute('href')).toBe('/cabinet/guide');
    expect(guide.className.includes('is-active')).toBe(on);
    const items = Array.from(document.querySelectorAll('.sb-nav > .sb-item')).map((n) => n.textContent);
    expect(items.indexOf('Справочник')).toBeLessThan(items.findIndex((t) => t?.startsWith('Все клиенты')));
  });
});

// Карточка дня клиента: на открытой «Сегодня» её нет — там тот же трекер с индексом и полосками (b05);
// в других разделах — индекс и полоски по оценкам.
describe('Sidebar — карточка дня клиента', () => {
  const NEEDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'].map((id) => ({ id, emoji: '', title: id, chartLabel: id }));
  const FULL = { attachment: 6, autonomy: 7, expression: 5, play: 6, limits: 6 };
  const renderClient = (path: string) => render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar items={[]} therapistMode={false} userRole="CLIENT" onSwitchMode={vi.fn()} therapistClients={[]}
               needs={NEEDS} ratings={FULL} displayName="Аня" onOpenTracker={vi.fn()} onOpenSettings={vi.fn()} />
    </MemoryRouter>,
  );

  it.each(['/today', '/'])('%s: индекса и полосок дня в меню нет', (path) => {
    renderClient(path);
    expect(document.querySelector('.sb-today')).toBeNull();
    expect(screen.queryByText('6,0')).toBeNull();
  });

  it.each(['/diary', '/more'])('%s: карточка дня с индексом и полосками', (path) => {
    renderClient(path);
    expect(screen.getByText('6,0')).toBeTruthy();
    expect(document.querySelector('.sb-today svg')).not.toBeNull();
  });
});

describe('Sidebar — «Показ экрана»', () => {
  it('выключен: имена, число клиентов и поиск на месте; тумблер объясняет, что сделает', () => {
    const { container } = renderSidebar();
    expect(visibleNames(container)).toEqual(NAMES);
    expect(badge()).toBe('5');
    expect(screen.getByPlaceholderText('Поиск клиента…')).toBeTruthy();
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Скрыть имена клиентов')).toBeTruthy();
  });

  it('включён: ни имён, ни инициалов, ни ссылок в карточки, ни поиска, ни числа клиентов', () => {
    const { container } = renderSidebar();
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    expect(visibleNames(container)).toEqual([]);
    expect(container.querySelectorAll('.sb-client-item, .sb-client-av')).toHaveLength(0);
    expect(container.querySelector('a[href^="/cabinet/"]:not([href="/cabinet"]):not([href="/cabinet/today"]):not([href="/cabinet/guide"]):not([href="/cabinet/tasks"])')).toBeNull();
    expect(screen.queryByPlaceholderText('Поиск клиента…')).toBeNull();
    expect(badge()).toBe('');
    expect(screen.getByText('Имена клиентов скрыты')).toBeTruthy();
  });

  it('выключение возвращает список и число; тап по подписи тоже переключает', () => {
    const { container } = renderSidebar();
    fireEvent.click(screen.getByText('Показ экрана'));
    expect(visibleNames(container)).toEqual([]);
    fireEvent.click(screen.getByText('Показ экрана'));
    expect(visibleNames(container)).toEqual(NAMES);
    expect(badge()).toBe('5');
  });

  it('режим пережил перезагрузку — имена скрыты с первого кадра', () => {
    setScreenShare(true);
    const { container } = renderSidebar();
    expect(visibleNames(container)).toEqual([]);
    expect(badge()).toBe('');
  });

  // Литерал в trackEvent видит трипваер analytics-sync; константа shared/ сверяется здесь.
  it('событие аналитики — только при включении, без данных о клиентах', () => {
    renderSidebar();
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(trackEvent.mock.calls).toEqual([[CABINET_SCREEN_SHARE_ON_EVENT]]);
  });
});
