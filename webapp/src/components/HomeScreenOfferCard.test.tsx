// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() }, reportClientError: vi.fn() }));
vi.mock('../apiClient', () => ({ authedFetch: vi.fn() }));
import { api } from '../api';
import { authedFetch } from '../apiClient';
import { HomeScreenOfferCard } from './HomeScreenOfferCard';
import { installTelegram, removeTelegram } from '../host/tgStub.test-helpers';

const MEMORY_KEY = 'home_screen_offer';

const CODE = 'c'.repeat(64);

beforeEach(() => {
  localStorage.clear();
  vi.mocked(authedFetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ deviceCode: CODE, expiresIn: 120 }),
  } as unknown as Response);
});
afterEach(() => {
  cleanup();
  removeTelegram();
  vi.clearAllMocks();
});

describe('HomeScreenOfferCard', () => {
  it('в браузере (хост web) не показывается и событий не шлёт', () => {
    const { container } = render(<HomeScreenOfferCard />);
    expect(container.firstChild).toBeNull();
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it('в Telegram на Android: показ, openLink на /install с кодом и снуз на неделю', async () => {
    const openLink = vi.fn();
    installTelegram({ platform: 'android', openLink });
    render(<HomeScreenOfferCard />);
    expect(api.trackEvent).toHaveBeenCalledWith('home_screen_offer', { action: 'shown', surface: 'today' });
    expect(screen.getByText(/открывается без Telegram/)).toBeTruthy();

    // Адрес с кодом приезжает после ответа сервера; до него — без кода.
    await waitFor(() => expect(authedFetch).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' }));
    expect(openLink).toHaveBeenCalledTimes(1);
    expect(String(openLink.mock.calls[0][0])).toMatch(new RegExp(`/install#h=${CODE}$`));
    expect(api.trackEvent).toHaveBeenCalledWith('home_screen_offer', { action: 'add', surface: 'today' });
    expect(Number(localStorage.getItem(MEMORY_KEY))).toBeGreaterThan(Date.now());
    expect(screen.queryByText('Установить приложение')).toBeNull();
  });

  it('на iOS кнопка — настоящая ссылка на /install', () => {
    installTelegram({ platform: 'ios' });
    render(<HomeScreenOfferCard />);
    const a = screen.getByRole('link', { name: 'Установить приложение' });
    expect(a.getAttribute('href')).toMatch(/\/install(#h=[0-9a-f]{64})?$/);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(screen.getByText(/Safari/)).toBeTruthy();
  });

  it('«Не предлагать» запоминается навсегда, «Позже» скрывает карточку', () => {
    installTelegram({ platform: 'android' });
    const { unmount } = render(<HomeScreenOfferCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Не предлагать' }));
    expect(localStorage.getItem(MEMORY_KEY)).toBe('never');
    unmount();
    const again = render(<HomeScreenOfferCard />);
    expect(again.container.firstChild).toBeNull();
  });

  it('на десктопном Telegram карточки нет', () => {
    installTelegram({ platform: 'tdesktop' });
    const { container } = render(<HomeScreenOfferCard />);
    expect(container.firstChild).toBeNull();
  });
});
