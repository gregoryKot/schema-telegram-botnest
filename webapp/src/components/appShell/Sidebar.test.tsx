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
vi.mock('../../api', () => ({ api: { trackEvent: (...a: unknown[]) => trackEvent(...a) } }));
vi.mock('../../auth/authContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

// Сначала размонтировать, потом выключить: без подписчиков смена режима не требует act.
afterEach(() => { cleanup(); setScreenShare(false); trackEvent.mockClear(); });

const NAMES = ['Анна Крылова', 'Борис', 'Вера', 'Глеб', 'Дина'];
const clients: TherapyClientSummary[] = NAMES.map((name, i) => ({
  telegramId: i + 1, name, clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
  recentIndexHistory: [], relationCreatedAt: '2026-01-01T00:00:00Z', therapyStartDate: null,
  nextSession: null, meetingDays: [], schemaIds: [],
}));

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/cabinet/1']}>
      <Sidebar items={[]} therapistMode userRole="THERAPIST" onSwitchMode={vi.fn()} therapistClients={clients}
               needs={[]} ratings={{}} displayName="Григорий" onOpenTracker={vi.fn()} onOpenSettings={vi.fn()} />
    </MemoryRouter>,
  );
}
const badge = () => screen.getByText('Все клиенты').closest('a')!.querySelector('.badge')!.textContent;
const toggle = () => screen.getByRole('switch', { name: /Показ экрана/ });
const visibleNames = (root: HTMLElement) => NAMES.filter((n) => root.textContent!.includes(n));

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
    expect(container.querySelector('a[href^="/cabinet/"]:not([href="/cabinet"]):not([href="/cabinet/today"])')).toBeNull();
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
