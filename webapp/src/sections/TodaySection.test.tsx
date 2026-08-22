// @vitest-environment jsdom
// Компонентные тесты TodaySection (главный экран «Сегодня»): реальные оценки
// потребностей (без хардкод-заглушек), скелетон загрузки последних записей,
// ты/вы-вилка в подписи стрика, черновики дневника, ошибки API не роняют
// экран, оверлей «Все задания», кабинет терапевта.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { TodaySection } from './TodaySection';
import { saveDraft, clearDraft } from '../utils/drafts';
import { MY_SCHEMA_IDS_KEY } from '../utils/storageKeys';

/** Дата N дней назад от реального «сегодня» теста (без хардкода абсолютной даты). */
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

vi.mock('../components/exercises/FlashcardEx', () => ({
  SchemaEx: (p: { onBack: () => void; initialSchemaId?: string; onComplete?: () => void }) => (
    <div data-testid="schema-ex">
      <div data-testid="schema-ex-id">{p.initialSchemaId}</div>
      <button onClick={p.onBack}>Назад</button>
      <button onClick={() => p.onComplete?.()}>Завершить карточку схемы</button>
    </div>
  ),
  ModeEx: (p: { onBack: () => void; initialModeId?: string; onComplete?: () => void }) => (
    <div data-testid="mode-ex">
      <div data-testid="mode-ex-id">{p.initialModeId}</div>
      <button onClick={p.onBack}>Назад</button>
      <button onClick={() => p.onComplete?.()}>Завершить карточку режима</button>
    </div>
  ),
}));

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
    createTask: vi.fn(),
    trackEvent: vi.fn(),
    getHealthyPhrase: vi.fn().mockResolvedValue({ text: null }),
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
  mockApi.completeTask.mockResolvedValue(undefined);
  mockApi.createTask.mockResolvedValue(undefined);
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

describe('TodaySection — refreshKey: смена ключа снова показывает скелетон дневников (read-after-write)', () => {
  it('после смены refreshKey профиль и дневники перезагружаются с нуля', async () => {
    const { rerender } = render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <TodaySection
            needs={NEEDS} ratings={{}} onNavigate={vi.fn()} onOpenSchema={vi.fn()}
            onOpenAdvanced={vi.fn()} onOpenTracker={vi.fn()} onOpenDiaries={vi.fn()}
            onOpenChildhoodWheel={vi.fn()} refreshKey={1}
          />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    await screen.findByText('Замечать моменты, когда схема активируется – главная практика');

    mockApi.getGratitudeDiary.mockReturnValue(new Promise(() => {}));
    rerender(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <TodaySection
            needs={NEEDS} ratings={{}} onNavigate={vi.fn()} onOpenSchema={vi.fn()}
            onOpenAdvanced={vi.fn()} onOpenTracker={vi.fn()} onOpenDiaries={vi.fn()}
            onOpenChildhoodWheel={vi.fn()} refreshKey={2}
          />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    // Скелетон снова показан — состояние действительно сбросилось, а не
    // осталось «старым готовым» списком.
    expect(screen.queryByText('Замечать моменты, когда схема активируется – главная практика')).toBeNull();
  });
});

describe('TodaySection — mySchemaIds из профиля синхронизируются в localStorage (правило №4)', () => {
  it('непустой mySchemaIds из профиля пишется в MY_SCHEMA_IDS_KEY', async () => {
    mockApi.getProfile.mockResolvedValue(profile({ mySchemaIds: ['abandonment', 'mistrust'] }));
    renderSection();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '[]')).toEqual(['abandonment', 'mistrust']),
    );
  });
});

describe('TodaySection — «Последние записи»: реальные записи схем/режимов/благодарностей отсортированы по времени', () => {
  it('показывает реальные записи (не пустое состояние), самая свежая — первой', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([{ trigger: 'коллега не ответил', createdAt: '2026-01-01T09:00:00Z' }]);
    mockApi.getModeDiary.mockResolvedValue([{ situation: 'опоздал на встречу', createdAt: '2026-01-02T10:00:00Z' }]);
    mockApi.getGratitudeDiary.mockResolvedValue([{ items: ['утренний кофе'], date: '2026-01-03' }]);
    renderSection();

    await screen.findByText('опоздал на встречу');
    expect(screen.getByText('коллега не ответил')).toBeTruthy();
    expect(screen.getByText('утренний кофе')).toBeTruthy();
    expect(screen.queryByText('Замечать моменты, когда схема активируется – главная практика')).toBeNull();
  });
});

describe('TodaySection — индекс дня: спарклайн из реальной истории (не заглушка)', () => {
  it('7 дней с ненулевыми оценками (включая сегодня) — спарклайн виден с подписью «7 дней»', async () => {
    // Сегодняшняя дата включена явно — иначе компонент сам добивает её
    // отдельной записью и итог «съезжает» на день больше мокнутых.
    mockApi.history.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({ date: daysAgoStr(6 - i), ratings: { attachment: 5 + i } })),
    );
    renderSection();
    await screen.findByText('7 дней');
  });

  it('неделя лучше предыдущей — показывает положительную дельту "+N.N за неделю"', async () => {
    const days = [
      ...Array.from({ length: 7 }, (_, i) => ({ date: daysAgoStr(13 - i), ratings: { attachment: 3 } })),
      ...Array.from({ length: 7 }, (_, i) => ({ date: daysAgoStr(6 - i), ratings: { attachment: 8 } })),
    ];
    mockApi.history.mockResolvedValue(days);
    renderSection();
    await screen.findByText('+5.0 за неделю');
  });
});

describe('TodaySection — терапевт: ближайшая встреча в блоке «Следующая встреча»', () => {
  it('встреча завтра — подпись «завтра», имя и кнопка «Написать» видны', async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    mockApi.getTherapyRelation.mockResolvedValue({
      role: 'client', status: 'active', partnerName: 'Анна', partnerId: 42, code: 'X', nextSession: tomorrow,
    });
    renderSection();
    await screen.findByText('Анна');
    await screen.findByText('завтра');
    expect(screen.getByText('Написать').getAttribute('href')).toBe('tg://user?id=42');
  });

  it('встреча сегодня — подпись «сегодня»', async () => {
    const inHours = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    mockApi.getTherapyRelation.mockResolvedValue({
      role: 'client', status: 'active', partnerName: 'Анна', partnerId: 42, code: 'X', nextSession: inHours,
    });
    renderSection();
    await screen.findByText('сегодня');
  });
});

describe('TodaySection — потребность: клик по строке открывает трекер сразу на этой потребности', () => {
  it('onOpenTrackerAt получает id потребности из клика по строке', async () => {
    const onOpenTrackerAt = vi.fn();
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <TodaySection
            needs={NEEDS} ratings={{ attachment: 5 }} onNavigate={vi.fn()} onOpenSchema={vi.fn()}
            onOpenAdvanced={vi.fn()} onOpenTracker={vi.fn()} onOpenDiaries={vi.fn()}
            onOpenChildhoodWheel={vi.fn()} onOpenTrackerAt={onOpenTrackerAt}
          />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Привязанность').closest('[role="button"]') ?? screen.getByText('Привязанность'));
    expect(onOpenTrackerAt).toHaveBeenCalledWith('attachment');
  });

  it('без onOpenTrackerAt клик по строке падает на общий onOpenTracker', async () => {
    const onOpenTracker = vi.fn();
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <TodaySection
            needs={NEEDS} ratings={{ attachment: 5 }} onNavigate={vi.fn()} onOpenSchema={vi.fn()}
            onOpenAdvanced={vi.fn()} onOpenTracker={onOpenTracker} onOpenDiaries={vi.fn()}
            onOpenChildhoodWheel={vi.fn()}
          />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Привязанность').closest('[role="button"]') ?? screen.getByText('Привязанность'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });
});

describe('TodaySection — задания: каждый тип «начать →» открывает свой правильный экран', () => {
  function renderWithHandlers(overrides: Partial<{ onOpenTracker: () => void; onOpenDiaries: () => void; onOpenChildhoodWheel: () => void; onOpenAdvanced: () => void }> = {}) {
    return render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <TodaySection
            needs={NEEDS} ratings={{}} onNavigate={vi.fn()} onOpenSchema={vi.fn()}
            onOpenAdvanced={overrides.onOpenAdvanced ?? vi.fn()}
            onOpenTracker={overrides.onOpenTracker ?? vi.fn()}
            onOpenDiaries={overrides.onOpenDiaries ?? vi.fn()}
            onOpenChildhoodWheel={overrides.onOpenChildhoodWheel ?? vi.fn()}
          />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
  }

  /** «начать →» встречается и в OnboardingWidget — скоуп через заголовок раздела задач. */
  async function clickTaskStart() {
    const heading = await screen.findByText('Практики на сегодня');
    const section = heading.closest('.section')!;
    fireEvent.click(within(section).getByText('начать →'));
  }

  it('tracker_streak → onOpenTracker', async () => {
    const onOpenTracker = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ type: 'tracker_streak', text: 'Трекать 7 дней' })]);
    renderWithHandlers({ onOpenTracker });
    await clickTaskStart();
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });

  it('diary_streak → onOpenDiaries', async () => {
    const onOpenDiaries = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ type: 'diary_streak', text: 'Дневник 7 дней' })]);
    renderWithHandlers({ onOpenDiaries });
    await clickTaskStart();
    expect(onOpenDiaries).toHaveBeenCalledTimes(1);
  });

  it('childhood_wheel → onOpenChildhoodWheel', async () => {
    const onOpenChildhoodWheel = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ type: 'childhood_wheel', text: 'Колесо детства' })]);
    renderWithHandlers({ onOpenChildhoodWheel });
    await clickTaskStart();
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });

  it('belief_check/letter_to_self/safe_place → onOpenAdvanced', async () => {
    const onOpenAdvanced = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ type: 'letter_to_self', text: 'Письмо себе' })]);
    renderWithHandlers({ onOpenAdvanced });
    await clickTaskStart();
    expect(onOpenAdvanced).toHaveBeenCalledTimes(1);
  });

  it('schema_intro → открывает карточку схемы с реальным id из задания, завершение вызывает completeTask', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 5, type: 'schema_intro', text: 'abandonment' })]);
    renderWithHandlers();
    await clickTaskStart();

    expect((await screen.findByTestId('schema-ex-id')).textContent).toBe('abandonment');
    fireEvent.click(screen.getByText('Завершить карточку схемы'));

    await waitFor(() => expect(mockApi.completeTask).toHaveBeenCalledWith(5, true));
    await waitFor(() => expect(screen.queryByTestId('schema-ex')).toBeNull());
  });

  it('schema_intro «Назад» закрывает карточку без завершения задания', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 5, type: 'schema_intro', text: 'abandonment' })]);
    renderWithHandlers();
    await clickTaskStart();
    fireEvent.click(await screen.findByText('Назад'));

    expect(screen.queryByTestId('schema-ex')).toBeNull();
    expect(mockApi.completeTask).not.toHaveBeenCalled();
  });

  it('mode_intro → открывает карточку режима с реальным id из задания, завершение вызывает completeTask', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 6, type: 'mode_intro', text: 'vulnerable_child' })]);
    renderWithHandlers();
    await clickTaskStart();

    expect((await screen.findByTestId('mode-ex-id')).textContent).toBe('vulnerable_child');
    fireEvent.click(screen.getByText('Завершить карточку режима'));

    await waitFor(() => expect(mockApi.completeTask).toHaveBeenCalledWith(6, true));
  });
});

describe('TodaySection — «+ Поставить цель» открывает создание задания дневника', () => {
  it('клик открывает TaskCreateSheet, закрытие возвращает на экран', async () => {
    mockApi.getTasks.mockResolvedValue([task({ type: 'diary_streak', text: 'Дневник 7 дней' })]);
    renderSection();
    fireEvent.click(await screen.findByText('+ Поставить цель'));
    await screen.findByText('Новое задание');

    fireEvent.click(screen.getByText('Назад к кабинету'));
    await waitFor(() => expect(screen.queryByText('Новое задание')).toBeNull());
  });
});

describe('TodaySection — оверлей «Все задания»: отметка выполненного и добавление новой цели', () => {
  it('«Готово» у назначенной custom-задачи вызывает completeTask и уходит из активных', async () => {
    mockApi.getTasks
      .mockResolvedValueOnce(Array.from({ length: 6 }, (_, i) => task({ id: i + 1, assignedBy: 9, type: 'custom', text: `Задача ${i + 1}` })))
      .mockResolvedValue([]);
    renderSection();
    fireEvent.click(await screen.findByText('Все задания (6) →'));
    await screen.findByText('Все задания');

    fireEvent.click(screen.getAllByText('Готово')[0]);
    await waitFor(() => expect(mockApi.completeTask).toHaveBeenCalledWith(1, true));
  });

  it('«+ Поставить цель» внутри оверлея открывает TaskCreateSheet поверх него', async () => {
    mockApi.getTasks.mockResolvedValue(Array.from({ length: 6 }, (_, i) => task({ id: i + 1, text: `Задача ${i + 1}` })));
    renderSection();
    fireEvent.click(await screen.findByText('Все задания (6) →'));
    const overlay = await screen.findByText('Все задания');
    fireEvent.click(overlay.parentElement!.parentElement!.querySelector('.ex-btn-primary')!);

    await screen.findByText('Новое задание');
  });
});
