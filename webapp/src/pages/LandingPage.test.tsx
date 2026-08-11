// @vitest-environment jsdom
// LandingPage — публичный сайт-визитка (0% покрытия, 84 непокрытых строки).
// Логика здесь минимальна (в основном JSX/стили — тест не обязателен по
// CLAUDE.md), но одна вещь user-facing и завязана на реальные данные:
// цена сессии в блоке «Формат и цены» приходит из api.getBookingOptions,
// а не зашита в код (правило «Никаких хардкод-заглушек»). Плюс smoke-рендер
// без падений (лениво используемые IntersectionObserver-хуки из landing-kit-hooks).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';

vi.mock('../api', () => ({
  api: {
    getBookingOptions: vi.fn(),
    getSiteContent: vi.fn(),
    getSlots: vi.fn().mockResolvedValue([]),
    cancelBooking: vi.fn(),
    bookSlot: vi.fn(),
    listArticles: vi.fn().mockResolvedValue([]),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// jsdom не реализует IntersectionObserver (useReveal) — минимальный мок,
// как рекомендует сам хук в комментарии про failsafe.
class MockIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSiteContent.mockResolvedValue({ heroPhoto: null, marqueeTopicsA: [], marqueeTopicsB: [] });
  localStorage.clear();
});

afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage — цена сессии из реальных данных', () => {
  it('на чистом состоянии (пока API не ответил) показывает дефолт 4000 ₽, а не пусто/NaN', () => {
    mockApi.getBookingOptions.mockReturnValue(new Promise(() => {})); // не резолвится
    renderPage();
    expect(screen.getByText('4 000 ₽')).toBeTruthy();
  });

  it('после ответа API цена берётся из SESSION_50, а не из хардкода', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 5500, note: '' },
    ]);
    await act(async () => { renderPage(); });
    expect(screen.getByText('5 500 ₽')).toBeTruthy();
    expect(screen.queryByText('4 000 ₽')).toBeNull();
  });

  it('ответ без SESSION_50 не ломает рендер — остаётся дефолтная цена', async () => {
    mockApi.getBookingOptions.mockResolvedValue([
      { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, note: '' },
    ]);
    await act(async () => { renderPage(); });
    expect(screen.getByText('4 000 ₽')).toBeTruthy();
  });
});

describe('LandingPage — smoke', () => {
  it('рендерит ключевые секции без падений', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    // «Обо мне» встречается несколько раз (навигация x2 + подзаголовок секции).
    expect(screen.getAllByText('Обо мне').length).toBeGreaterThan(0);
    expect(screen.getByText('Как устроена работа')).toBeTruthy();
    expect(screen.getByText('Что нужно знать')).toBeTruthy();
  });

  it('переключатель темы меняет aria-label кнопки', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    const btn = screen.getAllByLabelText(/тема/)[0];
    const before = btn.getAttribute('aria-label');
    fireEvent.click(btn);
    const after = screen.getAllByLabelText(/тема/)[0].getAttribute('aria-label');
    expect(after).not.toBe(before);
  });

  it('открытие мобильного меню показывает MobileMenu', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    const menuBtns = screen.getAllByLabelText('Открыть меню');
    fireEvent.click(menuBtns[0]);
    expect(screen.getByLabelText('Закрыть меню')).toBeTruthy();
  });
});

// Регрессия-по-смыслу: запись физически принимается только на сайте практики
// (kotlarewski) — на schemehappens и любом другом хосте кнопка обязана
// увести туда, а не пытаться скроллить несуществующую форму записи.
describe('LandingPage — «Записаться» ведёт на правильный сайт по хосту', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
  });

  it('на schemehappens.ru (не практика) уводит на сайт практики', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hostname: 'schemehappens.ru', href: 'https://schemehappens.ru/' },
      configurable: true,
      writable: true,
    });
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    fireEvent.click(screen.getAllByText('Записаться на знакомство →')[0]);
    expect(window.location.href).toBe('https://kotlarewski.gr/#booking');
  });

  it('на самом kotlarewski.ru скроллит к форме на странице, а не уводит', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hostname: 'kotlarewski.ru', href: 'https://kotlarewski.ru/' },
      configurable: true,
      writable: true,
    });
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    const scrollSpy = vi.fn();
    // jsdom не реализует layout — подменяем scrollIntoView на секции записи.
    const bookingSection = document.getElementById('booking')!;
    bookingSection.scrollIntoView = scrollSpy;
    fireEvent.click(screen.getAllByText('Записаться на знакомство →')[0]);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    // Хост не подставной — адрес не поменялся.
    expect(window.location.href).toBe('https://kotlarewski.ru/');
  });
});

describe('LandingPage — хэш-переход при первой загрузке (/#prices)', () => {
  const originalLocation = window.location;

  it('открытие ссылки с хэшем прокручивает к нужному блоку', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hash: '#prices', hostname: 'schemehappens.ru' },
      configurable: true,
      writable: true,
    });
    mockApi.getBookingOptions.mockResolvedValue([]);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      let utils!: ReturnType<typeof renderPage>;
      act(() => { utils = renderPage(); });
      const pricesSection = utils.container.querySelector('#prices') as HTMLElement;
      const scrollSpy = vi.fn();
      pricesSection.scrollIntoView = scrollSpy;
      act(() => { vi.runAllTimers(); });
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
    }
  });
});
