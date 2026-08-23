// @vitest-environment jsdom
// App.tsx — какой экран показан и когда: скелетон по форме контента на
// загрузке (правило CLAUDE.md «скелетоны, а не спиннеры»), видимая ошибка
// вместо молчания, экран входа в браузере при протухшей сессии, начальная
// секция из URL/localStorage, офлайн-баннер по реальным browser-событиям.
// Дочерние секции/оверлеи — заглушки (App.test-helpers.tsx).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  screen,
  waitFor,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import {
  renderApp,
  setUrl,
  mockUseUserFlags,
} from './test-support/App.test-helpers';
import { defaultFlags } from './test-support/App.test-fixtures';
import { api } from './api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mockUseUserFlags.mockReturnValue(defaultFlags());
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('App — состояние загрузки: скелетон по форме экрана, не спиннер', () => {
  it('пока начальные данные не пришли — силуэт (aria-hidden плашки), не спиннер и не пустой экран', () => {
    const { container } = renderApp();
    // TodayScreenSkeleton/ScreenSkeleton собраны из Skeleton-плашек (aria-hidden,
    // без текста) — сравниваем с секциями, которых на этом кадре ещё нет.
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId('app-sections')).toBeNull();
  });

  it('после загрузки скелетон уходит и рендерятся секции', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
  });
});

describe('App — ошибка начальной загрузки видна пользователю (правило: не молчим)', () => {
  it('needs() падает → показывает «Не удалось загрузить» с кнопкой «Повторить», секций нет', async () => {
    mockApi.needs.mockRejectedValueOnce(new Error('network down'));
    renderApp();
    await waitFor(() =>
      expect(screen.getByText('Не удалось загрузить')).toBeTruthy(),
    );
    expect(screen.getByText('Повторить')).toBeTruthy();
    expect(screen.queryByTestId('app-sections')).toBeNull();
  });
});

describe('App — сессия протухла посреди работы (web-хост → экран входа, не «Сессия истекла»)', () => {
  it('событие session-expired в браузере показывает LoginScreen, а не ошибку 401', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent(window, new Event('session-expired'));
    await waitFor(() => expect(screen.getByText('Всё по схеме')).toBeTruthy());
    expect(screen.queryByText('Не удалось загрузить')).toBeNull();
    expect(screen.queryByTestId('app-sections')).toBeNull();
  });
});

describe('App — начальная секция решается URL и localStorage (getInitialSection)', () => {
  it('без query и localStorage — по умолчанию «today»', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.section).toBe('today'),
    );
  });

  it('?section=profile выбирает секцию «Профиль»', async () => {
    setUrl('/?section=profile');
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.section).toBe(
        'profile',
      ),
    );
  });

  it('?section=schemas выбирает секцию «Паттерны»', async () => {
    setUrl('/?section=schemas');
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.section).toBe(
        'schemas',
      ),
    );
  });

  it('запомненная в localStorage секция применяется, если в URL секции нет', async () => {
    localStorage.setItem('default_section', 'profile');
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.section).toBe(
        'profile',
      ),
    );
  });

  it('query-параметр важнее localStorage', async () => {
    localStorage.setItem('default_section', 'profile');
    setUrl('/?section=schemas');
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.section).toBe(
        'schemas',
      ),
    );
  });

  it('неизвестное значение в localStorage игнорируется — остаётся «today»', async () => {
    localStorage.setItem('default_section', 'not-a-real-section');
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.section).toBe('today'),
    );
  });
});

describe('App — офлайн-баннер по реальным browser-событиям (не по константе)', () => {
  it('offline показывает баннер, online его убирает', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    expect(
      screen.queryByText('Нет подключения — данные не сохраняются'),
    ).toBeNull();

    fireEvent(window, new Event('offline'));
    await waitFor(() =>
      expect(
        screen.getByText('Нет подключения — данные не сохраняются'),
      ).toBeTruthy(),
    );

    fireEvent(window, new Event('online'));
    await waitFor(() =>
      expect(
        screen.queryByText('Нет подключения — данные не сохраняются'),
      ).toBeNull(),
    );
  });
});

// Прогрев данных чужих вкладок обязан ждать данных первого экрана: на 3G
// девять прогревочных запросов, ушедших с маунта, толкались за канал с
// needs/ratings и чанком «Сегодня» (замер 2026-08-23, холодный старт
// 4044 → 4398мс). Гейт — loading=false (см. эффект prefetchStarted в App.tsx).
describe('прогрев данных чужих вкладок ждёт первый экран', () => {
  it('prefetchOtherSectionsData/preloadDiarySheets не зовутся, пока needs висит', async () => {
    const { prefetchOtherSectionsData } =
      await import('./utils/prefetchSectionData');
    const { preloadDiarySheets } = await import('./components/LazyDiarySheets');
    let resolveNeeds: (v: never[]) => void = () => {};
    mockApi.needs.mockReturnValueOnce(
      new Promise<never[]>((r) => {
        resolveNeeds = r;
      }),
    );
    renderApp();
    // Пока needs висит — App в состоянии загрузки, прогрев не стартует.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(prefetchOtherSectionsData).not.toHaveBeenCalled();
    expect(preloadDiarySheets).not.toHaveBeenCalled();

    resolveNeeds([]);
    await waitFor(() => expect(prefetchOtherSectionsData).toHaveBeenCalled());
    expect(preloadDiarySheets).toHaveBeenCalledTimes(1);
  });
});
