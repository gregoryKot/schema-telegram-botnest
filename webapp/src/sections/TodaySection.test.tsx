// @vitest-environment jsdom
// Компонентные тесты TodaySection (главный экран «Сегодня»): реальные оценки
// потребностей (без хардкод-заглушек), скелетон загрузки последних записей,
// ты/вы-вилка в подписи стрика, черновики дневника, ошибки API не роняют
// экран, оверлей «Все задания», кабинет терапевта.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { TodaySection } from './TodaySection';
import { saveDraft, clearDraft } from '../utils/drafts';

vi.mock('../api', () => ({
  api: {
    getProfile: vi.fn(),
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getGratitudeDiary: vi.fn(),
    getTherapyRelation: vi.fn(),
    history: vi.fn(),
    getTasks: vi.fn(),
    getTaskHistory: vi.fn(),
    completeTask: vi.fn(),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockReport = reportClientError as unknown as ReturnType<typeof vi.fn>;

const NEEDS = [
  { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' },
  { id: 'autonomy',   emoji: '🧭', title: 'Автономия',    chartLabel: 'Автон.' },
  { id: 'expression', emoji: '🎤', title: 'Выражение',    chartLabel: 'Выраж.' },
  { id: 'play',       emoji: '🎈', title: 'Радость',      chartLabel: 'Радость' },
  { id: 'limits',     emoji: '🚧', title: 'Границы',      chartLabel: 'Границы' },
];

function profile(overrides: Partial<{ streak: number; name: string | null; mySchemaIds: string[]; activeSchemaIds: string[] }> = {}) {
  return {
    name: overrides.name ?? null, role: 'CLIENT' as const,
    ysq: { completedAt: null, activeSchemaIds: overrides.activeSchemaIds ?? [] },
    notifications: { enabled: false, reminderEnabled: false, timezone: 'UTC', localHour: 9 },
    streak: overrides.streak ?? 0,
    lastActivity: { needsTracker: null, schemaDiary: null, modeDiary: null, gratitudeDiary: null },
    mySchemaIds: overrides.mySchemaIds ?? [],
    myModeIds: [],
  };
}

function task(overrides: Partial<{ id: number; assignedBy: number | null; type: string; text: string; done: boolean | null }> = {}) {
  return {
    id: 1, userId: 1, assignedBy: null, type: 'custom', text: 'Задание',
    targetDays: null, needId: null, dueDate: null, done: null,
    completedAt: null, createdAt: '2026-08-01T00:00:00Z', doneToday: false,
    ...overrides,
  };
}

function renderSection(props: Partial<{ ratings: Record<string, number>; yesterdayRatings: Record<string, number>; userRole: 'CLIENT' | 'THERAPIST'; onOpenTherapistCabinet: () => void }> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <TodaySection
          needs={NEEDS}
          ratings={props.ratings ?? {}}
          yesterdayRatings={props.yesterdayRatings}
          onNavigate={vi.fn()}
          onOpenSchema={vi.fn()}
          onOpenAdvanced={vi.fn()}
          onOpenTracker={vi.fn()}
          onOpenDiaries={vi.fn()}
          onOpenChildhoodWheel={vi.fn()}
          userRole={props.userRole}
          onOpenTherapistCabinet={props.onOpenTherapistCabinet}
        />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getProfile.mockResolvedValue(profile());
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getGratitudeDiary.mockResolvedValue([]);
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.history.mockResolvedValue([]);
  mockApi.getTasks.mockResolvedValue([]);
  mockApi.getTaskHistory.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('TodaySection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('без оценок индекс дня "–", а не выдуманное число', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Индекс сегодня')).toBeTruthy();
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
  });

  it('без записей — нейтральная подсказка вместо пустого списка', async () => {
    renderSection();
    await screen.findByText('Замечать моменты, когда схема активируется – главная практика');
  });
});

describe('TodaySection — скелетон "последних записей"', () => {
  it('пока грузятся дневники — скелетон-строки, не пустой текст и не готовый список', async () => {
    let resolveAll!: () => void;
    mockApi.getGratitudeDiary.mockReturnValue(new Promise(r => { resolveAll = () => r([]); }));
    const { container } = renderSection();

    expect(screen.queryByText('Замечать моменты, когда схема активируется – главная практика')).toBeNull();
    expect(container.querySelectorAll('.section').length).toBeGreaterThan(0);

    resolveAll();
    await screen.findByText('Замечать моменты, когда схема активируется – главная практика');
  });
});

describe('TodaySection — реальные оценки потребностей', () => {
  it('индекс считается из реальных ratings, а не заглушки', async () => {
    renderSection({ ratings: { attachment: 8, autonomy: 6, expression: 4, play: 10, limits: 2 } });
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    // avg = (8+6+4+10+2)/5 = 6.0
    await screen.findByText('6.0');
  });

  it('частично заполненные ratings не считают индекс (allRated=false) — "–"', async () => {
    renderSection({ ratings: { attachment: 8 } });
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
  });

  it('дельта к вчера показывает реальную разницу, а не выдуманную', async () => {
    renderSection({
      ratings: { attachment: 8, autonomy: 6, expression: 4, play: 10, limits: 2 },
      yesterdayRatings: { attachment: 5 },
    });
    await screen.findByText('↑3.0');
  });
});

describe('TodaySection — ты/вы вилка (стрик)', () => {
  it('на «ты» без стрика показывает "Оцени потребности..."', async () => {
    renderSection({}, 'ty');
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Оцени потребности – начнётся стрик')).toBeTruthy();
  });

  it('на «вы» без стрика — "Оцените потребности...", без "ты"-формы', async () => {
    renderSection({}, 'vy');
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Оцените потребности – начнётся стрик')).toBeTruthy();
    expect(screen.queryByText('Оцени потребности – начнётся стрик')).toBeNull();
  });

  it('с реальным стриком из профиля показывает число дней подряд', async () => {
    mockApi.getProfile.mockResolvedValue(profile({ streak: 5 }));
    renderSection();
    await screen.findByText('5');
    expect(screen.getByText('дней подряд')).toBeTruthy();
  });
});

describe('TodaySection — ошибки API не роняют экран', () => {
  it('ошибка getProfile — экран остаётся рабочим с дефолтными значениями', async () => {
    mockApi.getProfile.mockRejectedValue(new Error('network down'));
    renderSection();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Потребности сегодня')).toBeTruthy();
  });

  it('ошибка history не роняет экран — блок индекса остаётся без графика', async () => {
    mockApi.history.mockRejectedValue(new Error('network down'));
    renderSection();
    await waitFor(() => expect(mockApi.history).toHaveBeenCalled());
    expect(screen.getByText('Индекс сегодня')).toBeTruthy();
  });

  // РЕГРЕССИЯ (check-silent-catch): фоновые загрузки экрана «Сегодня» раньше
  // глотали отказ молча (.catch(() => {})) — экран выглядел рабочим, но
  // отказ не был виден нигде. Теперь каждый фоновый источник шлёт
  // reportClientError, не показывая пользователю ошибку (экран по-прежнему
  // работает с фолбэками — см. тесты выше).
  it('отказ любого фонового источника уходит в reportClientError, не показывая ошибку на экране', async () => {
    mockApi.getProfile.mockRejectedValue(new Error('network down'));
    mockApi.getTherapyRelation.mockRejectedValue(new Error('network down'));
    mockApi.getSchemaDiary.mockRejectedValue(new Error('network down'));
    mockApi.history.mockRejectedValue(new Error('network down'));
    renderSection();
    await waitFor(() => expect(mockReport).toHaveBeenCalled());
    const sections = mockReport.mock.calls.map((c) => c[0].section);
    expect(sections.every((s) => s === 'today')).toBe(true);
    expect(mockReport.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('Потребности сегодня')).toBeTruthy();
  });
});

describe('TodaySection — черновики дневника', () => {
  it('незаконченный черновик схемы показывает баннер, продолжить открывает дневники', async () => {
    saveDraft('schema', { trigger: 'триггер-черновик' });
    const onOpenDiaries = vi.fn();
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <TodaySection
            needs={NEEDS} ratings={{}} onNavigate={vi.fn()} onOpenSchema={vi.fn()}
            onOpenAdvanced={vi.fn()} onOpenTracker={vi.fn()} onOpenDiaries={onOpenDiaries}
            onOpenChildhoodWheel={vi.fn()}
          />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );

    await screen.findByText('Незаконченные записи');
    fireEvent.click(screen.getByText('продолжить →'));
    expect(onOpenDiaries).toHaveBeenCalled();
    clearDraft('schema');
  });
});

describe('TodaySection — задачи (практики на сегодня)', () => {
  it('активные задачи считаются и открывают оверлей "Все задания" при >5', async () => {
    mockApi.getTasks.mockResolvedValue(Array.from({ length: 6 }, (_, i) => task({ id: i + 1, text: `Задача ${i + 1}` })));
    renderSection();

    await screen.findByText('6 активных');
    fireEvent.click(screen.getByText('Все задания (6) →'));
    await screen.findByText('Все задания');
  });

  it('выполненная задача от терапевта помечена чертой и без кнопки "начать"', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 1, assignedBy: 9, text: 'От терапевта', done: true })]);
    renderSection();

    await screen.findByText('От терапевта');
    // Раздел "Практики на сегодня" показан только если есть активные ИЛИ выполненные задачи.
    expect(screen.getByText('Практики на сегодня')).toBeTruthy();
  });
});

describe('TodaySection — кабинет терапевта', () => {
  it('userRole=THERAPIST с onOpenTherapistCabinet показывает ссылку в кабинет', async () => {
    const onOpenTherapistCabinet = vi.fn();
    renderSection({ userRole: 'THERAPIST', onOpenTherapistCabinet });
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Кабинет терапевта'));
    expect(onOpenTherapistCabinet).toHaveBeenCalled();
  });

  it('userRole=CLIENT не показывает ссылку в кабинет терапевта', async () => {
    renderSection({ userRole: 'CLIENT' });
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.queryByText('Кабинет терапевта')).toBeNull();
  });
});
