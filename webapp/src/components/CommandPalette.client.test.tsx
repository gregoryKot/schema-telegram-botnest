// @vitest-environment jsdom
// Общий поиск в режиме клиента: строка схемы ведёт в «Паттерны» с состоянием маршрута и шлёт
// search_result_open без текста запроса (клик и Enter); своё задание открывается в «Заданиях» на «Ещё».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { getSchemaById } from '../../../shared/src/schemaTherapy/schemaTherapyData';
import { SEARCH_RESULT_OPEN_EVENT } from '../../../shared/src/share/searchAnalytics';

const trackEvent = vi.fn();
const requestTasksOpen = vi.fn();
vi.mock('../sections/tasks/tasksLaunch', () => ({ requestTasksOpen: (...a: unknown[]) => requestTasksOpen(...a) }));
const reportClientError = vi.fn();
vi.mock('../auth/authContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../api', () => ({
  reportClientError: (...a: unknown[]) => reportClientError(...a),
  api: {
    trackEvent: (...a: unknown[]) => trackEvent(...a), listArticles: () => Promise.resolve([]),
    getTasks: () => Promise.resolve([{ id: 42, assignedBy: 7, type: 'custom', text: 'Записать три тёплых момента', dueDate: null, done: null }]),
    getPlanHistory: () => Promise.reject(new Error('сеть')),
  },
}));

const SCHEMA = getSchemaById('abandonment')!.name;
const input = () => screen.getByPlaceholderText<HTMLInputElement>('Схема, упражнение, задание, раздел…');

function Where() {
  const { pathname, state } = useLocation();
  return <output data-testid="where">{pathname} {JSON.stringify(state)}</output>;
}
function renderPalette(onNavigate = vi.fn()) {
  render(<MemoryRouter initialEntries={['/today']}><CommandPalette onNavigate={onNavigate} onClose={vi.fn()} userRole="CLIENT" /><Where /></MemoryRouter>);
  return onNavigate;
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);

describe('CommandPalette — режим клиента', () => {
  it('клик по схеме: переход в «Паттерны» с целью в состоянии маршрута, событие без текста запроса', () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: 'покинутость' } });
    expect(screen.getByText('Схемы', { selector: '.cmd-group' })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: new RegExp(SCHEMA) }));
    expect(screen.getByTestId('where').textContent).toBe('/schemas {"openPattern":{"kind":"schema","id":"abandonment"}}');
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'pattern', typed: true, recent: false });
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain('покинутость');
    expect(localStorage.getItem('search_recent')).toBe('["pattern:schema:abandonment"]');
  });

  it('Enter по первой строке открывает ту же схему', () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: 'покинутость' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toContain('/schemas {"openPattern":{"kind":"schema","id":"abandonment"}}');
    expect(trackEvent).toHaveBeenCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'pattern', typed: true, recent: false });
  });

  it('своё задание видно без запроса; выбор просит «Ещё» открыть его, название в событие не уходит', async () => {
    const onNavigate = renderPalette();
    fireEvent.click(await screen.findByRole('option', { name: /Записать три тёплых момента/ }));
    expect(screen.getByText('Мои задания', { selector: '.cmd-group' })).toBeTruthy();
    expect(requestTasksOpen).toHaveBeenCalledWith(42);
    expect(onNavigate).toHaveBeenCalledWith('more');
    expect(trackEvent).toHaveBeenCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'own_task', typed: false, recent: false });
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain('тёплых');
    // планы не загрузились: группы нет, сбой ушёл отчётом
    expect(reportClientError).toHaveBeenCalledWith({ message: 'search: планы не загрузились', section: 'commandPalette' });
  });
});
