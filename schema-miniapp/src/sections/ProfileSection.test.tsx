// @vitest-environment jsdom
// ProfileSection — экран «Я»: прогрессивный рендер (замер 2026-08-22,
// профиль 3G+CPU×4). Раньше streak/achievements/insights/history(112)
// грузились одним Promise.all с единым `ready` — самый долгий ответ
// (history) держал пустым весь экран (1321мс). Теперь у каждой карточки
// свой скелетон ПО ФОРМЕ контента, и она рисуется, как только пришли именно
// её данные — не дожидаясь соседей. Тяжёлая history(112) для тепловой карты
// вынесена в отдельный ленивый HeatmapCard (свой тест).
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
    // Редизайн вкладки «Я»: useAboutMe грузит это отдельно от
    // streak/achievements/insights (useProfileStats) — без моков здесь
    // undefined() упал бы синхронно внутри useEffect.
    getProfile: vi.fn(),
    getYsqHistory: vi.fn(),
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getModeNotes: vi.fn(),
    getPhraseChecks: vi.fn(),
    getSchemaNotes: vi.fn(),
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
vi.mock('./profile/PortraitSheet', () => ({
  PortraitSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="portrait-sheet">
      <button onClick={onClose}>portrait-sheet-close</button>
    </div>
  ),
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
  mockApi.getProfile.mockResolvedValue({
    name: null,
    role: 'CLIENT',
    ysq: { completedAt: null, activeSchemaIds: [] },
    notifications: {
      enabled: false,
      reminderEnabled: false,
      timezone: 'UTC',
      localHour: 9,
    },
    streak: 0,
    lastActivity: {
      needsTracker: null,
      schemaDiary: null,
      modeDiary: null,
      gratitudeDiary: null,
    },
    mySchemaIds: [],
    myModeIds: [],
  });
  mockApi.getYsqHistory.mockResolvedValue([]);
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getModeNotes.mockResolvedValue([]);
  mockApi.getPhraseChecks.mockResolvedValue([]);
  mockApi.getSchemaNotes.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  setHost(null);
  vi.useRealTimers();
});

function baseProps() {
  return { onOpenSettings: vi.fn(), onOpenPatterns: vi.fn() };
}

// «Мой портрет» (карточка useAboutMe) — самый тяжёлый узел загрузки: у него
// шесть параллельных запросов (getProfile/getYsqHistory/getSchemaDiary/
// getModeDiary/getModeNotes/getPhraseChecks) против одиночных цепочек
// streak/achievements/insights, поэтому он settle-ится последним или
// одновременно с ними — ждать его достаточно, чтобы остальные тоже осели.
async function renderReady(
  props: Partial<Parameters<typeof ProfileSection>[0]> = {},
) {
  const utils = render(<ProfileSection {...baseProps()} {...props} />);
  await screen.findByText('Мой портрет');
  return utils;
}

describe('ProfileSection — прогрессивный рендер (каждая карточка ждёт только свои данные)', () => {
  it('пока getStreak не ответил — виден скелетон стрика, но карточка ачивок с реальными данными уже показана', async () => {
    mockApi.getStreak.mockReturnValue(new Promise(() => {}));
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);
    render(<ProfileSection {...baseProps()} />);

    await screen.findByTestId('streak-skeleton');
    expect(screen.queryByText('всего')).toBeNull();
    await waitFor(() => expect(screen.getByText(/Достижени/)).toBeTruthy());
  });

  it('все три запроса (streak/achievements/insights) уходят одной волной — без ожидания друг друга', () => {
    render(<ProfileSection {...baseProps()} />);
    expect(mockApi.getStreak).toHaveBeenCalledTimes(1);
    expect(mockApi.getAchievements).toHaveBeenCalledTimes(1);
    expect(mockApi.getInsights).toHaveBeenCalledTimes(1);
  });

  it('«Мой путь» не зависит ни от одного запроса — виден сразу, до разрешения любого промиса', () => {
    mockApi.getStreak.mockReturnValue(new Promise(() => {}));
    mockApi.getAchievements.mockReturnValue(new Promise(() => {}));
    mockApi.getInsights.mockReturnValue(new Promise(() => {}));
    mockApi.getProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfileSection {...baseProps()} />);
    expect(screen.getByText(/Мой путь/)).toBeTruthy();
  });

  it('тепловая карта не блокирует первый экран: history() зависает, но стрик и ачивки всё равно отрисовываются', async () => {
    mockApi.history.mockReturnValue(new Promise(() => {}));
    mockApi.getStreak.mockResolvedValue({
      currentStreak: 3,
      longestStreak: 3,
      totalDays: 5,
      todayDone: true,
      weekDots: [],
    });
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);
    await renderReady();
    await waitFor(() => expect(screen.getByText('всего')).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Достижени/)).toBeTruthy());
  });

  it('ошибка одной карточки (achievements) не роняет соседние — стрик и инсайты рисуются как обычно', async () => {
    mockApi.getAchievements.mockRejectedValue(new Error('network'));
    mockApi.getStreak.mockResolvedValue({
      currentStreak: 2,
      longestStreak: 4,
      totalDays: 6,
      todayDone: true,
      weekDots: [],
    });
    await renderReady();
    await waitFor(() => expect(screen.getByText('всего')).toBeTruthy());
    expect(screen.queryByText(/Достижени/)).toBeNull();
  });

  it('getModeNotes/getPhraseChecks уходят вместе с первой волной aboutMe, а не второй (regression: замер 2026-08-22, +621мс на 3G)', () => {
    render(<ProfileSection {...baseProps()} />);
    expect(mockApi.getModeNotes).toHaveBeenCalledTimes(1);
    expect(mockApi.getPhraseChecks).toHaveBeenCalledTimes(1);
    // Не дублируем ради тёплых слов — тот же modeEntries, что и для портрета.
    expect(mockApi.getModeDiary).toHaveBeenCalledTimes(1);
  });
});

describe('ProfileSection — карточки рисуются только из реальных данных', () => {
  it('на чистом аккаунте (нулевой стрик, без ачивок/инсайтов) — карточки стрика/инсайтов не показаны', async () => {
    await renderReady();
    await waitFor(() =>
      expect(screen.queryByTestId('streak-skeleton')).toBeNull(),
    );
    expect(screen.queryByText(/растёт/)).toBeNull();
  });

  it('с реальными достижениями показывает карточку ачивок', async () => {
    mockApi.getAchievements.mockResolvedValue([
      { id: 'first_day', earned: true },
    ]);
    await renderReady();
    await waitFor(() => expect(screen.getByText(/Достижени/)).toBeTruthy());
  });
});

describe('ProfileSection — открытие «Мой путь» (JourneySheet)', () => {
  it('клик по карточке «Мой путь» открывает лист', async () => {
    await renderReady();
    fireEvent.click(screen.getByText(/Мой путь/));
    expect(screen.getByTestId('journey-sheet')).toBeTruthy();
  });
});

describe('ProfileSection — открытие «Мой портрет» (PortraitSheet, my_schemas/my_modes переехали внутрь листа)', () => {
  it('клик по карточке «Мой портрет» открывает лист и закрывается назад', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Мой портрет'));
    expect(screen.getByTestId('portrait-sheet')).toBeTruthy();
    fireEvent.click(screen.getByText('portrait-sheet-close'));
    expect(screen.queryByTestId('portrait-sheet')).toBeNull();
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
  it('смена refreshKey перезапрашивает все источники заново', async () => {
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
    expect(screen.queryByTestId('streak-skeleton')).toBeNull();
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
    expect(screen.queryByTestId('streak-skeleton')).toBeNull();
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
        'portrait',
        'warm_words',
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
    await renderReady();
    await waitFor(() => expect(screen.getByText(/Достижени/)).toBeTruthy());
    await waitFor(() => expect(screen.getByText('всего')).toBeTruthy());
    const container = screen.getByText('всего').closest('.section-pad')!;
    const texts = Array.from(container.querySelectorAll('.card')).map(
      (c) => c.textContent,
    );
    const idxAchievements = texts.findIndex((t) => t?.includes('Достижени'));
    const idxStreak = texts.findIndex((t) => t?.includes('всего'));
    const idxJourney = texts.findIndex((t) => t?.includes('Мой путь'));
    expect(idxAchievements).toBeLessThan(idxStreak);
    expect(idxStreak).toBeLessThan(idxJourney);
  });

  it('ArrowUp на ручке строки листа поднимает «Серию дней»: шлёт screen_block_move, персистит и переставляет карточки', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран профиля'));
    await screen.findByText('Настроить экран');
    // Порядок листа по умолчанию (SCREEN_BLOCK_ORDER.profile после переезда
    // «Мои схемы»/«Мои режимы» внутрь листа «Мой портрет»): Мой портрет,
    // Тёплые слова, Мой путь, Серия дней, Календарь, Достижения, Паттерны —
    // «Серия дней» четвёртая строка, сразу после «Мой путь».
    fireEvent.keyDown(screen.getByLabelText('Переставить: Серия дней'), {
      key: 'ArrowUp',
    });
    expect(mockApi.trackEvent).toHaveBeenCalledWith('screen_block_move', {
      screen: 'profile',
      block: 'streak',
      dir: 'up',
    });
    expect(localStorage.getItem('screen_order_profile')).toBe(
      JSON.stringify([
        'portrait',
        'warm_words',
        'streak',
        'journey',
        'heatmap',
        'achievements',
        'insights',
      ]),
    );
    fireEvent.click(screen.getByText('Готово'));
    await waitFor(() => expect(screen.getByText('всего')).toBeTruthy());
    const container = screen.getByText('всего').closest('.section-pad')!;
    const texts = Array.from(container.querySelectorAll('.card')).map(
      (c) => c.textContent,
    );
    expect(texts.findIndex((t) => t?.includes('всего'))).toBeLessThan(
      texts.findIndex((t) => t?.includes('Мой путь')),
    );
  });

  it('ArrowUp на ручке первой строки (край) — no-op, ничего не персистит', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран профиля'));
    await screen.findByText('Настроить экран');
    // «Мой портрет» — первая строка листа (SCREEN_BLOCK_ORDER.profile).
    fireEvent.keyDown(screen.getByLabelText('Переставить: Мой портрет'), {
      key: 'ArrowUp',
    });
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'screen_block_move',
      expect.anything(),
    );
    expect(localStorage.getItem('screen_order_profile')).toBeNull();
  });

  it('клавиша на ручке в листе не переключает тумблер строки', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран профиля'));
    await screen.findByText('Настроить экран');
    fireEvent.keyDown(screen.getByLabelText('Переставить: Мой путь'), {
      key: 'ArrowDown',
    });
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(
      'screen_block_toggle',
      expect.anything(),
    );
  });
});
