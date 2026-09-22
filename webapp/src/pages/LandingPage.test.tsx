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
import { OPERATOR_INN, OPERATOR_STATUS } from '../legal/operator';

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

// jsdom не реализует IntersectionObserver (useReveal, useLandingGoals) —
// минимальный мок, как рекомендует сам хук useReveal в комментарии про
// failsafe. Инстансы и их callback сохраняются в статическом поле, чтобы
// тесты на цель prices_view могли дёрнуть пересечение вручную.
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  elements: Element[] = [];
  disconnected = false;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) { this.elements.push(el); }
  disconnect() { this.disconnected = true; }
  unobserve() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// Имитирует реальное поведение браузера: после disconnect() колбэк больше
// не вызывается (наш мок сам по себе этого не гарантирует — this.callback
// вызывается тестом напрямую, а не движком).
function fireIntersection(inst: MockIntersectionObserver, isIntersecting: boolean) {
  if (inst.disconnected) return;
  inst.callback([{ isIntersecting } as IntersectionObserverEntry], inst as unknown as IntersectionObserver);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSiteContent.mockResolvedValue({ heroPhoto: null, marqueeTopicsA: [], marqueeTopicsB: [] });
  localStorage.clear();
  sessionStorage.clear();
  MockIntersectionObserver.instances = [];
  // Метрика (lib/metrika) грузится реально, не мокается — booking_start
  // проверяет именно дедуп «одна цель за сессию» из trackGoalOnce.
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((s) => s.remove());
  // jsdom не реализует scrollIntoView — глобальный дефолт-стаб; отдельные
  // тесты ниже переопределяют его точечно на конкретном элементе.
  Element.prototype.scrollIntoView = vi.fn();
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

describe('LandingPage — футер показывает реквизиты', () => {
  it('в футере есть ИНН и статус самозанятого из общего источника реквизитов', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    const footer = document.querySelector('footer');
    expect(footer).toBeTruthy();
    const text = footer?.textContent ?? '';
    expect(text).toMatch(new RegExp(`ИНН\\s+${OPERATOR_INN}`));
    expect(text).toMatch(new RegExp(OPERATOR_STATUS));
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

// Регрессия (задача 2026-09-16): визитка практики крутит рекламу уже сейчас,
// а продукт «Всё по схеме» / schemehappens.ru ещё не готов — до перезапуска
// ссылок на продукт на визитке быть не должно (история сохранена в git,
// правило про удаление, а не комментирование).
describe('LandingPage — визитка без отсылок к приложению', () => {
  it('не упоминает «Всё по схеме» и не показывает ссылку «Войти»', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    expect(screen.queryByText(/Всё по схеме/)).toBeNull();
    expect(screen.queryByText('Войти')).toBeNull();
  });

  it('нет ссылок на schemehappens.ru и нет бот-ссылок кроме t.me/kotlarewski', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    expect(document.querySelectorAll('a[href*="schemehappens.ru"]').length).toBe(0);
    const tgLinks = Array.from(document.querySelectorAll('a[href*="t.me/"]'));
    expect(tgLinks.length).toBeGreaterThan(0);
    for (const a of tgLinks) {
      expect(a.getAttribute('href')).toBe('https://t.me/kotlarewski');
    }
  });

  it('мобильное меню не показывает пункт «Всё по схеме»', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    fireEvent.click(screen.getAllByLabelText('Открыть меню')[0]);
    expect(screen.queryByText('Всё по схеме')).toBeNull();
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
      // instant, не auto/smooth: html{scroll-behavior:smooth} из LandingStyles
      // превращал бы прыжок в анимацию на тысячи пикселей — см. useHashJump.
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
    }
  });
});

// Регрессия (задача 2026-09-22): объявления Яндекс.Директа ведут прямо на
// карточку темы («Отношения», «Тревога и контроль» и т.п.), а не на верх
// блока — карточке нужен свой id и отступ прокрутки под липкую шапку.
describe('LandingPage — якоря карточек «С чем я работаю» (для объявлений Директа)', () => {
  it.each([
    ['Отношения', 'relationships'],
    ['Самооценка', 'self-esteem'],
    ['Тревога и контроль', 'anxiety'],
    ['Повторяющиеся паттерны', 'patterns'],
  ])('у карточки «%s» есть id=%s и отступ прокрутки под липкую шапку', async (title, id) => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    const heading = screen.getByText(title);
    const card = heading.closest('div[id]') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.id).toBe(id);
    // Без scrollMarginTop карточка при переходе по якорю прячется под sticky-bar (58px).
    expect(card.style.scrollMarginTop).toBe('72px');
  });
});

describe('LandingPage — хэш-переход при первой загрузке (/#anxiety)', () => {
  const originalLocation = window.location;

  it('открытие ссылки с хэшем на карточку прокручивает к ней', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hash: '#anxiety', hostname: 'schemehappens.ru' },
      configurable: true,
      writable: true,
    });
    mockApi.getBookingOptions.mockResolvedValue([]);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      let utils!: ReturnType<typeof renderPage>;
      act(() => { utils = renderPage(); });
      const anxietySection = utils.container.querySelector('#anxiety') as HTMLElement;
      const scrollSpy = vi.fn();
      anxietySection.scrollIntoView = scrollSpy;
      act(() => { vi.runAllTimers(); });
      // instant, не auto/smooth: та же причина, что у теста /#prices выше —
      // smooth из LandingStyles съедал переход на восемь тысяч пикселей.
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
    }
  });

  it('после догрузки вёрстки прыжок повторяется (0/200/600мс)', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hash: '#anxiety', hostname: 'schemehappens.ru' },
      configurable: true,
      writable: true,
    });
    mockApi.getBookingOptions.mockResolvedValue([]);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      let utils!: ReturnType<typeof renderPage>;
      act(() => { utils = renderPage(); });
      const anxietySection = utils.container.querySelector('#anxiety') as HTMLElement;
      const scrollSpy = vi.fn();
      anxietySection.scrollIntoView = scrollSpy;
      act(() => { vi.runAllTimers(); });
      // Один прыжок в начале не защищает от того, что карточка уедет вниз,
      // пока догружаются картинки — нужен повтор, а не однократный вызов.
      expect(scrollSpy.mock.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
    }
  });

  it('живой скролл пользователя (wheel) отменяет оставшиеся повторы', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hash: '#anxiety', hostname: 'schemehappens.ru' },
      configurable: true,
      writable: true,
    });
    mockApi.getBookingOptions.mockResolvedValue([]);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      let utils!: ReturnType<typeof renderPage>;
      act(() => { utils = renderPage(); });
      const anxietySection = utils.container.querySelector('#anxiety') as HTMLElement;
      const scrollSpy = vi.fn();
      anxietySection.scrollIntoView = scrollSpy;
      const callsAfterFirstJump = scrollSpy.mock.calls.length;
      act(() => { window.dispatchEvent(new Event('wheel')); });
      act(() => { vi.runAllTimers(); });
      // Пользователь уже сам скроллит — оставшиеся 200/600мс не должны
      // дёргать экран у него под рукой.
      expect(scrollSpy.mock.calls.length).toBe(callsAfterFirstJump);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
    }
  });
});

// Продуктовые цели лендинга (Яндекс.Метрика, владелец решил не ждать
// согласия на баннере — см. lib/metrika). Гоняем на реальной очереди
// window.ym.a, а не на моке '../lib/metrika': для booking_start важно
// проверить именно дедуп «одна цель за сессию», который живёт в
// trackGoalOnce — мок его не воспроизведёт.
describe('LandingPage — цели Метрики', () => {
  function ymQueue(): unknown[][] {
    return (window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? [];
  }
  function goalHits(name: string) {
    return ymQueue().filter((c) => c[1] === 'reachGoal' && c[2] === name);
  }

  it('клик по ссылке t.me/kotlarewski шлёт цель tg_click (делегированный слушатель)', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    const link = document.querySelector('a[href="https://t.me/kotlarewski"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    // jsdom пытается «перейти» по реальной ссылке — гасим переход, тестируем
    // только факт клика (как MobileAppBanner.test.tsx).
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(goalHits('tg_click').length).toBe(1);
  });

  it('клик по кнопке записи шлёт booking_start, повторный клик по другой кнопке — уже нет (одна цель за сессию)', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    fireEvent.click(screen.getAllByText('Записаться бесплатно →')[0]);
    fireEvent.click(screen.getAllByText('Записаться на знакомство →')[0]);
    expect(goalHits('booking_start').length).toBe(1);
  });

  it('пересечение блока #prices на 50% шлёт цель prices_view один раз', async () => {
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    const pricesEl = document.getElementById('prices')!;
    const inst = MockIntersectionObserver.instances.find((i) => i.elements.includes(pricesEl));
    expect(inst).toBeTruthy();
    act(() => {
      fireIntersection(inst!, true);
      fireIntersection(inst!, true);
    });
    expect(goalHits('prices_view').length).toBe(1);
  });
});

// Регрессия: эффект зеркалирования активной секции в адресную строку раньше
// писал только pathname + hash и СРЕЗАЛ query — ссылка из Яндекс.Директа
// (?utm_source=yandex&yclid=123) теряла параметры через миг после загрузки,
// ещё до того, как tag.js успевал их прочитать.
describe('LandingPage — UTM/yclid не теряются при скролле (регрессия)', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('utm_source и yclid остаются в адресной строке после скролла', async () => {
    window.history.replaceState({}, '', '/?utm_source=yandex&yclid=123#booking');
    mockApi.getBookingOptions.mockResolvedValue([]);
    await act(async () => { renderPage(); });
    // Первый scroll — служебный прогон скроллспая (firstRun), второй уже
    // пишет activeSection и триггерит replaceState.
    await act(async () => {
      fireEvent.scroll(window);
      await new Promise((r) => setTimeout(r, 20));
    });
    await act(async () => {
      fireEvent.scroll(window);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(window.location.search).toContain('utm_source=yandex');
    expect(window.location.search).toContain('yclid=123');
  });
});
