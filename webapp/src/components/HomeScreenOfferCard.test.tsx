// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../api';
import { HomeScreenOfferCard } from './HomeScreenOfferCard';
import { installTelegram, removeTelegram } from '../host/tgStub.test-helpers';

const MEMORY_KEY = 'home_screen_offer';

beforeEach(() => localStorage.clear());
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

  it('в Telegram на Android: показ, нативный add() и снуз на неделю', () => {
    const addToHomeScreen = vi.fn();
    installTelegram({ platform: 'android', addToHomeScreen, checkHomeScreenStatus: (cb: (s: string) => void) => cb('missed') });
    render(<HomeScreenOfferCard />);
    expect(api.trackEvent).toHaveBeenCalledWith('home_screen_offer', { action: 'shown', surface: 'today' });

    fireEvent.click(screen.getByRole('button', { name: 'Добавить значок' }));
    expect(addToHomeScreen).toHaveBeenCalledTimes(1);
    expect(api.trackEvent).toHaveBeenCalledWith('home_screen_offer', { action: 'add', surface: 'today' });
    expect(Number(localStorage.getItem(MEMORY_KEY))).toBeGreaterThan(Date.now());
    expect(screen.queryByText('Добавить значок')).toBeNull();
  });

  it('на iOS кнопка — настоящая ссылка на прыжковую страницу', () => {
    installTelegram({ platform: 'ios', addToHomeScreen: vi.fn(), checkHomeScreenStatus: (cb: (s: string) => void) => cb('missed') });
    render(<HomeScreenOfferCard />);
    const a = screen.getByRole('link', { name: 'Добавить значок' });
    expect(a.getAttribute('href')).toMatch(/add-icon\.html$/);
    expect(a.getAttribute('target')).toBe('_blank');
  });

  it('«Не предлагать» запоминается навсегда, «Позже» скрывает карточку', () => {
    installTelegram({ platform: 'android', addToHomeScreen: vi.fn(), checkHomeScreenStatus: (cb: (s: string) => void) => cb('missed') });
    const { unmount } = render(<HomeScreenOfferCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Не предлагать' }));
    expect(localStorage.getItem(MEMORY_KEY)).toBe('never');
    unmount();
    const again = render(<HomeScreenOfferCard />);
    expect(again.container.firstChild).toBeNull();
  });

  it('Telegram говорит «значок уже есть» — карточка скрывается', () => {
    installTelegram({
      platform: 'android',
      addToHomeScreen: vi.fn(),
      checkHomeScreenStatus: (cb: (s: string) => void) => cb('added'),
    });
    const { container } = render(<HomeScreenOfferCard />);
    expect(container.firstChild).toBeNull();
  });
});
