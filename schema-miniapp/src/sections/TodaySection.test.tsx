// @vitest-environment jsdom
// TodaySection — главный экран «Сегодня» (0% покрытия, самый большой файл
// мини-аппа). Тяжёлые независимые подкомпоненты (у каждого свой тест)
// мокаем, чтобы бить по СОБСТВЕННОЙ логике TodaySection: параллельные
// загрузки (профиль/дневники), вычисление hasSchemas/todayDone из
// реальных данных (не заглушка — правило «никаких хардкод-заглушек»),
// сворачивание «Что ещё можно сегодня» с персистентностью в localStorage,
// баннер терапевта, фокус-карточка дня.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { setHost, createWebHost } from '../../../shared/src/host';
import { TodaySection } from './TodaySection';
import { TODAY_MORE_KEY } from './today/helpers';

// Даты — относительные к моменту запуска теста (не литералы): компонент
// сравнивает createdAt с «сегодня» (todayStr()), и фиксированная дата в
// прошлом рано или поздно перестаёт быть «сегодня» — тест ломается без
// единой правки кода на смене календарной даты.
const DAY = 24 * 60 * 60 * 1000;
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

vi.mock('../api', () => ({
  api: {
    getProfile: vi.fn(),
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getGratitudeDiary: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./today/OnboardingWidget', () => ({
  OnboardingWidget: ({ hasSchemas }: { hasSchemas: boolean }) => (
    <div data-testid="onboarding">hasSchemas={String(hasSchemas)}</div>
  ),
}));
vi.mock('./today/SecondaryCards', () => ({
  SecondaryCards: ({
    recentDiaries,
    onSetDiaryTask,
  }: {
    recentDiaries: { label: string }[];
    onSetDiaryTask: () => void;
  }) => (
    <div data-testid="secondary-cards">
      diaries={recentDiaries.length}
      <button onClick={onSetDiaryTask}>secondary-set-diary-task</button>
    </div>
  ),
}));
vi.mock('../components/PhraseShareCard', () => ({
  PhraseShareCard: () => <div data-testid="phrase-card" />,
}));
vi.mock('../components/HomeScreenOfferCard', () => ({
  HomeScreenOfferCard: () => <div data-testid="home-screen-offer" />,
}));
vi.mock('../share/DayShareButton', () => ({
  DayShareButton: () => <div data-testid="day-share" />,
}));
vi.mock('../components/TaskCreateSheet', () => ({
  TaskCreateSheet: ({
    defaultType,
    onCreated,
    onClose,
  }: {
    defaultType?: string;
    onCreated: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="task-create-sheet">
      type={defaultType ?? 'none'}
      <button onClick={onCreated}>task-create-created</button>
      <button onClick={onClose}>task-create-close</button>
    </div>
  ),
}));
vi.mock('../components/TodayCustomizeSheet', () => ({
  TodayCustomizeSheet: () => <div data-testid="customize-sheet" />,
}));

const NEEDS = [
  { id: 'attachment', name: 'Привязанность' },
  { id: 'autonomy', name: 'Автономия' },
] as unknown as Parameters<typeof TodaySection>[0]['needs'];

const BASE_PROFILE = {
  name: 'Аня',
  role: 'CLIENT' as const,
  ysq: { completedAt: null, activeSchemaIds: [] },
  notifications: {
    enabled: false,
    reminderEnabled: false,
    timezone: 'Europe/Moscow',
    localHour: 21,
  },
  streak: 0,
  lastActivity: {
    needsTracker: null,
    schemaDiary: null,
    modeDiary: null,
    gratitudeDiary: null,
  },
  mySchemaIds: [] as string[],
  myModeIds: [] as string[],
};

function baseProps() {
  return {
    needs: NEEDS,
    ratings: {},
    onOpenSchema: vi.fn(),
    onOpenAdvanced: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenDiaries: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getProfile.mockResolvedValue(BASE_PROFILE);
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getGratitudeDiary.mockResolvedValue([]);
  // Хост по умолчанию (web) с заданным именем — читаем через getHost().user().
  setHost({ ...createWebHost(), user: () => ({ id: '1', firstName: 'Аня' }) });
});

afterEach(() => {
  cleanup();
  setHost(null);
});

async function renderReady(
  props: Partial<Parameters<typeof TodaySection>[0]> = {},
) {
  const utils = render(<TodaySection {...baseProps()} {...props} />);
  await screen.findByTestId('onboarding');
  await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
  return utils;
}

describe('TodaySection — приветствие', () => {
  it('с именем пользователя из хоста показывает персональное приветствие', async () => {
    await renderReady();
    expect(screen.getByText(/Привет, Аня/)).toBeTruthy();
  });

  it('без имени (хост не отдал firstName) — нейтральное приветствие, не пусто', async () => {
    setHost({ ...createWebHost(), user: () => null });
    await renderReady();
    expect(screen.getByText('Добро пожаловать')).toBeTruthy();
  });
});

describe('TodaySection — hasSchemas считается из реальных данных профиля', () => {
  it('на чистом аккаунте (нет схем нигде) — hasSchemas=false, а не выдуманное значение', async () => {
    await renderReady();
    expect(screen.getByTestId('onboarding').textContent).toContain(
      'hasSchemas=false',
    );
  });

  it('схема пришла из YSQ-теста профиля — hasSchemas=true', async () => {
    mockApi.getProfile.mockResolvedValue({
      ...BASE_PROFILE,
      ysq: { completedAt: isoDaysAgo(30), activeSchemaIds: ['abandonment'] },
    });
    await renderReady();
    await waitFor(() =>
      expect(screen.getByTestId('onboarding').textContent).toContain(
        'hasSchemas=true',
      ),
    );
  });
});

describe('TodaySection — загрузка дневников', () => {
  it('реальные записи дневника попадают в SecondaryCards, а не заглушка', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([
      {
        id: 1,
        trigger: 'триггер',
        createdAt: isoDaysAgo(1),
      },
    ]);
    await renderReady();
    fireEvent.click(screen.getByText('Что ещё можно сегодня'));
    await waitFor(() =>
      expect(screen.getByTestId('secondary-cards').textContent).toContain(
        'diaries=1',
      ),
    );
  });
});

describe('TodaySection — «Что ещё можно сегодня» (сворачивание, персистентно)', () => {
  it('по умолчанию свёрнуто: SecondaryCards не рендерится', async () => {
    await renderReady();
    expect(screen.queryByTestId('secondary-cards')).toBeNull();
  });

  it('клик разворачивает и сохраняет состояние в localStorage', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Что ещё можно сегодня'));
    expect(screen.getByTestId('secondary-cards')).toBeTruthy();
    expect(localStorage.getItem(TODAY_MORE_KEY)).toBe('1');
  });

  it('при заранее сохранённом состоянии сразу открыто (без лишнего клика)', async () => {
    localStorage.setItem(TODAY_MORE_KEY, '1');
    await renderReady();
    expect(screen.getByTestId('secondary-cards')).toBeTruthy();
  });

  it('повторный клик сворачивает обратно и убирает ключ из localStorage', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Что ещё можно сегодня'));
    fireEvent.click(screen.getByText('Свернуть'));
    expect(screen.queryByTestId('secondary-cards')).toBeNull();
    expect(localStorage.getItem(TODAY_MORE_KEY)).toBeNull();
  });
});

describe('TodaySection — фокус-карточка дня по умолчанию открывает трекер', () => {
  it('клик по главному действию (практика по умолчанию — трекер) вызывает onOpenTracker', async () => {
    const onOpenTracker = vi.fn();
    await renderReady({ onOpenTracker });
    fireEvent.click(screen.getByText('Начать'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });
});

describe('TodaySection — баннер кабинета терапевта', () => {
  it('роли CLIENT баннер не показывается', async () => {
    await renderReady({ userRole: 'CLIENT' });
    expect(screen.queryByText(/[Кк]абинет/)).toBeNull();
  });

  it('роли THERAPIST с обработчиком открытия — баннер виден и кликабелен', async () => {
    const onOpenTherapistCabinet = vi.fn();
    await renderReady({ userRole: 'THERAPIST', onOpenTherapistCabinet });
    const banner = screen.getByText(/[Кк]абинет/);
    fireEvent.click(banner);
    expect(onOpenTherapistCabinet).toHaveBeenCalledTimes(1);
  });
});

describe('TodaySection — настройка экрана шестерёнкой', () => {
  it('клик по шестерёнке открывает лист настройки экрана', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить экран'));
    expect(screen.getByTestId('customize-sheet')).toBeTruthy();
  });
});

describe('TodaySection — создание цели «вести дневник» из SecondaryCards', () => {
  it('открывает TaskCreateSheet с типом diary_streak и закрывает после создания', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Что ещё можно сегодня'));
    fireEvent.click(screen.getByText('secondary-set-diary-task'));

    const sheet = screen.getByTestId('task-create-sheet');
    expect(sheet.textContent).toContain('type=diary_streak');

    fireEvent.click(screen.getByText('task-create-created'));
    expect(screen.queryByTestId('task-create-sheet')).toBeNull();
  });
});

// Band переставляемых блоков (screen_order_today): порядок из localStorage
// применяется к DOM, закреплённые блоки не переставляются (онбординг всегда
// сверху, предложение значка — всегда под band).
describe('TodaySection — порядок блоков band', () => {
  const follows = (a: Element, b: Element) =>
    !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('по умолчанию фраза выше «что ещё», онбординг первый, значок последний', async () => {
    await renderReady();
    const onboarding = screen.getByTestId('onboarding');
    const phrase = screen.getByTestId('phrase-card');
    // Блок «что ещё» по умолчанию свёрнут — его место держит кнопка-разворот.
    const secondary = screen.getByText('Что ещё можно сегодня');
    const offer = screen.getByTestId('home-screen-offer');
    expect(follows(onboarding, phrase)).toBe(true);
    expect(follows(phrase, secondary)).toBe(true);
    expect(follows(secondary, offer)).toBe(true);
  });

  it('сохранённый порядок меняет DOM: «что ещё» поднимается над фразой', async () => {
    localStorage.setItem(
      'screen_order_today',
      JSON.stringify(['secondary', 'phrase']),
    );
    await renderReady();
    const phrase = screen.getByTestId('phrase-card');
    const secondary = screen.getByText('Что ещё можно сегодня');
    const offer = screen.getByTestId('home-screen-offer');
    expect(follows(secondary, phrase)).toBe(true);
    // Закреплённые блоки на местах: значок — под band даже после перестановки.
    expect(follows(phrase, offer)).toBe(true);
    expect(follows(screen.getByTestId('onboarding'), secondary)).toBe(true);
  });
});
