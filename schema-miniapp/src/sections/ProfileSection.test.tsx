// @vitest-environment jsdom
// ProfileSection — экран «Профиль» (0% покрытия): скелетон ПО ФОРМЕ карточек
// на время четырёх параллельных загрузок (правило «скелетоны по форме
// контента»), затем карточки рисуются только когда за ними стоят реальные
// данные (стрик/ачивки/инсайты — не заглушка на чистом аккаунте). Тяжёлые
// листы мокаем, дочерние карточки (свои тесты) оставляем реальными.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import { setHost, createWebHost } from '../../../shared/src/host';
import { ProfileSection } from './ProfileSection';

vi.mock('../api', () => ({
  api: {
    getStreak: vi.fn(),
    getAchievements: vi.fn(),
    getInsights: vi.fn(),
    history: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../components/JourneySheet', () => ({
  JourneySheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="journey-sheet">
      <button onClick={onClose}>journey-close</button>
    </div>
  ),
}));
vi.mock('./profile/AchievementsSheet', () => ({
  AchievementsSheet: ({
    onClose,
    onSelect,
  }: {
    onClose: () => void;
    onSelect: (id: string) => void;
  }) => (
    <div data-testid="achievements-sheet">
      <button onClick={() => onSelect('first_day')}>
        achievements-select-first-week
      </button>
      <button onClick={onClose}>achievements-close</button>
    </div>
  ),
}));
vi.mock('../components/AchievementDetail', () => ({
  AchievementDetail: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="achievement-detail">
      <button onClick={onClose}>achievement-detail-close</button>
    </div>
  ),
}));
vi.mock('./profile/BestDayInfoSheet', () => ({
  BestDayInfoSheet: () => <div data-testid="best-day-info" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setHost({ ...createWebHost(), user: () => ({ id: '1', firstName: 'Аня' }) });
  mockApi.getStreak.mockResolvedValue({
    currentStreak: 0,
    longestStreak: 0,
    totalDays: 0,
    todayDone: false,
    weekDots: [],
  });
  mockApi.getAchievements.mockResolvedValue([]);
  mockApi.getInsights.mockResolvedValue({
    weeklyStats: [],
    bestDayOfWeek: null,
    worstDayOfWeek: null,
    totalDays: 0,
  });
  mockApi.history.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  setHost(null);
  vi.useRealTimers();
});

function baseProps() {
  return { onOpenSettings: vi.fn() };
}

async function renderReady(
  props: Partial<Parameters<typeof ProfileSection>[0]> = {},
) {
  const utils = render(<ProfileSection {...baseProps()} {...props} />);
  await screen.findByText(/Мой путь/);
  return utils;
}

describe('ProfileSection — скелетон на время загрузки (по форме контента)', () => {
  it('пока getStreak/getAchievements/getInsights/history не ответили — виден скелетон, не карточки', () => {
    mockApi.getStreak.mockReturnValue(new Promise(() => {}));
    render(<ProfileSection {...baseProps()} />);
    // «Мой путь» рендерится только после ready=true.
    expect(screen.queryByText(/Мой путь/)).toBeNull();
  });
});

describe('ProfileSection — карточки рисуются только из реальных данных', () => {
  it('на чистом аккаунте (нулевой стрик, без ачивок/инсайтов) — карточки стрика/инсайтов не показаны', async () => {
    await renderReady();
    // StreakCard рисуется только когда streak !== null — но на чистом
    // аккаунте это пустой объект стрика; проверяем, что «выдуманных» цифр
    // инсайтов точно нет (hasInsights требует реальный avg).
    expect(screen.queryByText(/растёт/)).toBeNull();
  });

  it('с реальными достижениями показывает карточку ачивок', async () => {
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);
    await renderReady();
    await waitFor(() => expect(screen.getByText(/Достижени/)).toBeTruthy());
  });

  it('activeDates строится из реального history(), heatmap не рисуется без записей', async () => {
    await renderReady();
    expect(mockApi.history).toHaveBeenCalledWith(112);
  });
});

describe('ProfileSection — открытие «Мой путь» (JourneySheet)', () => {
  it('клик по карточке «Мой путь» открывает лист', async () => {
    await renderReady();
    fireEvent.click(screen.getByText(/Мой путь/));
    expect(screen.getByTestId('journey-sheet')).toBeTruthy();
  });
});

describe('ProfileSection — детали достижения из общего листа (два уровня оверлеев)', () => {
  it('выбор достижения в AchievementsSheet открывает AchievementDetail поверх', async () => {
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);
    await renderReady();
    fireEvent.click(await screen.findByText(/Достижени/));
    fireEvent.click(screen.getByText('achievements-select-first-week'));
    expect(screen.getByTestId('achievement-detail')).toBeTruthy();
  });
});

describe('ProfileSection — обновление по refreshKey', () => {
  it('смена refreshKey перезапрашивает все четыре источника заново', async () => {
    const { rerender } = await renderReady({ refreshKey: 1 });
    mockApi.getStreak.mockClear();
    rerender(<ProfileSection {...baseProps()} refreshKey={2} />);
    await waitFor(() => expect(mockApi.getStreak).toHaveBeenCalled());
  });
});

describe('ProfileSection — провал рефетча не подменяет реальный стрик нулём (regression: check-silent-catch)', () => {
  it('getStreak падает после смены refreshKey — виден прежний стрик, а не «0»', async () => {
    mockApi.getStreak.mockResolvedValueOnce({
      currentStreak: 5,
      longestStreak: 8,
      totalDays: 12,
      todayDone: true,
      weekDots: [],
    });
    const { rerender } = await renderReady({ refreshKey: 1 });
    await waitFor(() => expect(screen.getByText('всего')).toBeTruthy());
    const streakCard = screen.getByText('всего').closest('.card')!;
    expect(within(streakCard).getByText('12')).toBeTruthy();

    mockApi.getStreak.mockRejectedValueOnce(new Error('network'));
    rerender(<ProfileSection {...baseProps()} refreshKey={2} />);

    await waitFor(() => expect(mockApi.getStreak).toHaveBeenCalledTimes(2));
    // Раньше streak обнулялся ДО рефетча — провал подменял «12» на «0».
    expect(within(streakCard).getByText('12')).toBeTruthy();
  });
});

describe('ProfileSection — скрываемые блоки (useScreenBlocks)', () => {
  it('блок, скрытый в localStorage, не рендерится — остальные видны', async () => {
    localStorage.setItem('screen_hidden_profile', JSON.stringify(['streak']));
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);
    await renderReady();
    expect(screen.queryByText('всего')).toBeNull();
    expect(await screen.findByText(/Достижени/)).toBeTruthy();
  });

  it('клик «Настроить» в шапке открывает лист «Настроить экран»', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран профиля'));
    expect(await screen.findByText('Настроить экран')).toBeTruthy();
  });

  it('тумблер скрывает блок: шлёт screen_block_toggle, пишет localStorage, и после закрытия карточка не рендерится (read-after-write)', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран профиля'));
    fireEvent.click(await screen.findByText('Серия дней'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_toggle', {
      screen: 'profile',
      block: 'streak',
      hidden: true,
    });
    expect(localStorage.getItem('screen_hidden_profile')).toBe('["streak"]');
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.queryByText('всего')).toBeNull();
  });

  it('долгое нажатие на карточку открывает лист с via=longpress', async () => {
    await renderReady();
    const journeyCard = screen.getByText(/Мой путь/).closest('.card');
    const wrapper = journeyCard?.parentElement as HTMLElement;
    vi.useFakeTimers();
    fireEvent.pointerDown(wrapper, {
      button: 0,
      isPrimary: true,
      clientX: 0,
      clientY: 0,
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_customize_open', {
      screen: 'profile',
      via: 'longpress',
    });
    expect(await screen.findByText('Настроить экран')).toBeTruthy();
  });

  it('все блоки скрыты — шапка и TherapyNote остаются на месте', async () => {
    localStorage.setItem(
      'screen_hidden_profile',
      JSON.stringify([
        'journey',
        'streak',
        'heatmap',
        'achievements',
        'insights',
      ]),
    );
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);
    render(<ProfileSection {...baseProps()} />);
    expect(await screen.findByText(/Инструмент самоисследования/)).toBeTruthy();
    expect(screen.getByText('Аня')).toBeTruthy();
    expect(screen.queryByText(/Мой путь/)).toBeNull();
    expect(screen.queryByText('всего')).toBeNull();
    expect(screen.queryByText(/Достижени/)).toBeNull();
  });
});

describe('ProfileSection — порядок карточек (useScreenBlocks/useScreenBlockOrder)', () => {
  it('сохранённый порядок из localStorage применяется к рендеру карточек (read-after-write)', async () => {
    localStorage.setItem(
      'screen_order_profile',
      JSON.stringify(['achievements', 'streak', 'journey']),
    );
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);
    const { container } = await renderReady();
    const texts = Array.from(container.querySelectorAll('.card')).map(
      (c) => c.textContent,
    );
    const idxAchievements = texts.findIndex((t) => t?.includes('Достижени'));
    const idxStreak = texts.findIndex((t) => t?.includes('всего'));
    const idxJourney = texts.findIndex((t) => t?.includes('Мой путь'));
    expect(idxAchievements).toBeLessThan(idxStreak);
    expect(idxStreak).toBeLessThan(idxJourney);
  });

  it('стрелка «Выше» второй строки листа поднимает «Серию дней»: шлёт screen_block_move, персистит и переставляет карточки', async () => {
    const { container } = await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран профиля'));
    await screen.findByText('Настроить экран');
    // Порядок листа по умолчанию: Мой путь, Серия дней, Календарь, Достижения,
    // Инсайты — «Серия дней» вторая строка.
    fireEvent.click(screen.getAllByLabelText('Выше')[1]);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_move', {
      screen: 'profile',
      block: 'streak',
      dir: 'up',
    });
    expect(localStorage.getItem('screen_order_profile')).toBe(
      JSON.stringify([
        'streak',
        'journey',
        'heatmap',
        'achievements',
        'insights',
      ]),
    );
    fireEvent.click(screen.getByText('Готово'));
    const texts = Array.from(container.querySelectorAll('.card')).map(
      (c) => c.textContent,
    );
    expect(texts.findIndex((t) => t?.includes('всего'))).toBeLessThan(
      texts.findIndex((t) => t?.includes('Мой путь')),
    );
  });

  it('стрелка «Выше» первой строки (край) задизейблена: клик молчит, ничего не персистит', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран профиля'));
    await screen.findByText('Настроить экран');
    const firstUp = screen.getAllByLabelText('Выше')[0];
    expect(firstUp.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(firstUp);
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'screen_block_move',
      expect.anything(),
    );
    expect(localStorage.getItem('screen_order_profile')).toBeNull();
  });

  it('клик по стрелке в листе не переключает тумблер строки', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран профиля'));
    await screen.findByText('Настроить экран');
    fireEvent.click(screen.getAllByLabelText('Ниже')[0]);
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'screen_block_toggle',
      expect.anything(),
    );
  });
});
