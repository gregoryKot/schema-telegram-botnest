// @vitest-environment jsdom
// Общий поиск, настройки и статьи через шов: Enter по разделу настроек открывает лист (useSettingsOpen)
// и шлёт search_result_open без текста запроса; клик по статье ведёт на её страницу.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { useSettingsOpen } from './settingsSheet/settingsLaunch';
import { SEARCH_RESULT_OPEN_EVENT } from '../../../shared/src/share/searchAnalytics';

const trackEvent = vi.fn();
const logout = vi.fn(() => Promise.resolve());
const listArticles = vi.fn();
const reportClientError = vi.fn();
vi.mock('../auth/authContext', () => ({ useAuth: () => ({ logout }) }));
vi.mock('../api', () => ({
  reportClientError: (...a: unknown[]) => reportClientError(...a),
  api: {
    trackEvent: (...a: unknown[]) => trackEvent(...a), listArticles: () => listArticles(),
    getTherapyClients: () => Promise.resolve([]), getTasks: () => Promise.resolve([]), getPlanHistory: () => Promise.resolve([]),
  },
}));

const ARTICLE = { id: 1, slug: 'chto-takoe-shema', title: 'Что такое схема', description: 'Откуда берутся сценарии', date: '2026-11-01', readMin: 5 };

function Where() {
  const { pathname } = useLocation();
  const [settingsOpen] = useSettingsOpen();
  return <output data-testid="where">{pathname} {settingsOpen ? 'настройки открыты' : 'настройки закрыты'}</output>;
}
function renderPalette(props: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  render(<MemoryRouter initialEntries={['/today']}><CommandPalette onNavigate={vi.fn()} onClose={vi.fn()} userRole="CLIENT" {...props} /><Where /></MemoryRouter>);
  return screen.getByRole<HTMLInputElement>('combobox', { name: 'Поиск' });
}
const where = () => screen.getByTestId('where').textContent;

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); listArticles.mockResolvedValue([ARTICLE]); });
afterEach(cleanup);

describe('CommandPalette — настройки и статьи', () => {
  it('Enter по разделу настроек: лист открывается, событие — вид setting без текста запроса', async () => {
    const input = renderPalette();
    fireEvent.change(input, { target: { value: 'тихие часы' } });
    expect(screen.getByText('Настройки', { selector: '.cmd-group' })).toBeTruthy();
    expect(where()).toBe('/today настройки закрыты');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(where()).toBe('/today настройки открыты'));
    expect(trackEvent).toHaveBeenCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'setting', typed: true, recent: false });
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain('тихие');
    expect(localStorage.getItem('search_recent')).toBe('["setting:s-notifications"]');
  });

  it('клик по статье в кабинете терапевта: переход на страницу статьи, название в событие не уходит', async () => {
    const input = renderPalette({ userRole: 'THERAPIST', therapistMode: true });
    fireEvent.change(input, { target: { value: 'сценарии' } });
    fireEvent.click(await screen.findByRole('option', { name: /Что такое схема/ }));
    await waitFor(() => expect(where()).toBe('/articles/chto-takoe-shema настройки закрыты'));
    expect(trackEvent).toHaveBeenCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'article', typed: true, recent: false });
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain('схема');
  });

  it('«Выйти» выходит из аккаунта; статьи не загрузились — группы нет, сбой ушёл отчётом', async () => {
    listArticles.mockRejectedValue(new Error('сеть'));
    const input = renderPalette();
    await waitFor(() => expect(reportClientError).toHaveBeenCalledWith({ message: 'search: статьи не загрузились', section: 'commandPalette' }));
    fireEvent.change(input, { target: { value: 'схема' } });
    expect(screen.queryByText('Статьи', { selector: '.cmd-group' })).toBeNull();
    fireEvent.change(input, { target: { value: 'выйти' } });
    fireEvent.click(screen.getByRole('option', { name: /Выйти/ }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });
});
