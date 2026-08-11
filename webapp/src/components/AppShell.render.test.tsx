// @vitest-environment jsdom
// AppShell — рендер по роуту, состояния загрузки/ошибки (CLAUDE.md: «ошибка
// API видна пользователю, лист не закрывается молча» + «скелетоны по форме
// контента»). Дочерние секции/оверлеи замоканы кнопочницами
// (AppShell.test-helpers.tsx) — здесь проверяем ТОЛЬКО то, что решает сам
// AppShell: какой экран показан по URL, что видно, пока грузятся данные, и
// что видно, если загрузка упала.
//
// НАЙДЕННЫЙ ДЕФЕКТ (не правим — это ревью существующего прод-кода, а не наша
// задача, только фиксируем тестом факт): AppShell.tsx рендерит на загрузке
// `<Loader minHeight="100vh">` — обычный спиннер, а не скелетон по форме
// экрана. Правило «Загрузка: скелетоны по форме контента» (CLAUDE.md) для
// этого экрана нарушено; тест ниже фиксирует РЕАЛЬНОЕ (не желаемое) поведение.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { renderAppShell } from './AppShell.test-helpers';
import { api } from '../api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error тестовый полифилл jsdom
  global.ResizeObserver = ResizeObserverStub;
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AppShell — состояние загрузки', () => {
  it('пока начальные данные не пришли — показывает спиннер (не скелетон по форме, см. комментарий выше)', () => {
    const { container } = renderAppShell('/today');
    // Проверяем СРАЗУ после рендера, до того как промисы резолвнутся —
    // именно в этот момент компонент обязан показать состояние загрузки.
    expect(container.querySelector('.spinner')).toBeTruthy();
  });

  it('после загрузки спиннер уходит и появляется секция «Сегодня»', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
  });
});

describe('AppShell — ошибка загрузки видна пользователю (правило: не молчим)', () => {
  it('needs() падает → показывает текст ошибки и кнопку «Повторить», не пустой экран', async () => {
    mockApi.needs.mockRejectedValueOnce(new Error('network down'));
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByText('Не удалось загрузить')).toBeTruthy());
    expect(screen.getByText('Повторить')).toBeTruthy();
    // На экране ошибки секция НЕ рендерится — иначе пользователь увидит
    // пустой/сломанный контент вместо явного сообщения об ошибке.
    expect(screen.queryByTestId('today-section')).toBeNull();
  });

  it('«Повторить» на экране ошибки перезагружает страницу', async () => {
    mockApi.needs.mockRejectedValueOnce(new Error('network down'));
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByText('Повторить')).toBeTruthy());
    fireEvent.click(screen.getByText('Повторить'));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('AppShell — роутинг: URL решает, какая секция показана', () => {
  it.each([
    ['/today', 'today-section'],
    ['/diary', 'diary-section'],
    ['/schemas', 'schemas-section'],
    ['/profile', 'profile-section'],
    ['/practice', 'practice-section'],
  ])('путь %s → рендерит testid %s', async (path, testid) => {
    renderAppShell(path);
    await waitFor(() => expect(screen.getByTestId(testid)).toBeTruthy());
  });

  it('легаси-путь /help редиректит на секцию «Практика» (sectionFromPath)', async () => {
    renderAppShell('/help');
    await waitFor(() => expect(screen.getByTestId('practice-section')).toBeTruthy());
  });

  it('неизвестный путь по умолчанию показывает «Сегодня»', async () => {
    renderAppShell('/some-unknown-path');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
  });

  it('переход по нижней мобильной навигации меняет секцию', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    const diaryLinks = screen.getAllByRole('link', { name: /Дневник/ });
    fireEvent.click(diaryLinks[0]);
    await waitFor(() => expect(screen.getByTestId('diary-section')).toBeTruthy());
  });
});

describe('AppShell — офлайн-индикатор (реальное browser-событие, не константа)', () => {
  it('событие offline показывает метку «офлайн», online её убирает', async () => {
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByTestId('today-section')).toBeTruthy());
    expect(screen.queryByText('офлайн')).toBeNull();

    fireEvent(window, new Event('offline'));
    await waitFor(() => expect(screen.getByText('офлайн')).toBeTruthy());

    fireEvent(window, new Event('online'));
    await waitFor(() => expect(screen.queryByText('офлайн')).toBeNull());
  });
});

describe('AppShell — виджет «Сегодня» в сайдбаре (реальные данные, не заглушка)', () => {
  // Правило «никаких хардкод-заглушек»: индекс дня либо посчитан из РЕАЛЬНЫХ
  // ratings, либо (на чистом аккаунте) показывает CTA «Заполнить дневник»,
  // а не выдуманное число.
  it('без оценок — CTA «Заполнить дневник», а не число', async () => {
    mockApi.needs.mockResolvedValueOnce([{ id: 'safety', emoji: '🛡️', title: 'Безопасность', chartLabel: 'Без.' }]);
    mockApi.ratings.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    renderAppShell('/today');
    await waitFor(() => expect(screen.getByText('Заполнить дневник →')).toBeTruthy());
  });

  it('когда все потребности оценены — считает индекс из реальных ratings', async () => {
    mockApi.needs.mockResolvedValueOnce([
      { id: 'safety', emoji: '🛡️', title: 'Безопасность', chartLabel: 'Без.' },
      { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Авт.' },
    ]);
    mockApi.ratings.mockResolvedValueOnce({ safety: 8, autonomy: 6 }).mockResolvedValueOnce({});
    renderAppShell('/today');
    // (8+6)/2 = 7.0 — ожидаем реально посчитанное значение, не хардкод.
    await waitFor(() => expect(screen.getByText('7.0')).toBeTruthy());
  });
});
