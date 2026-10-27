// @vitest-environment jsdom
// Главная «Сегодня»: три плитки (трекер / Что случилось / дневник), лента дня,
// задания терапевта, «Зачем это?». Только реальные данные: на чистом аккаунте —
// пустая лента и «Ещё не заполнен», а не выдуманные цифры.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { TodaySection } from './TodaySection';
import { WHY_SEEN_KEY } from './today/whySeen';
import { forEachTimeZoneAsync } from '../../../shared/src/utils/timeZone.test-helpers';

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
vi.mock('../components/caseFlow/CaseFlowHost', () => ({
  CaseFlowHost: (p: { start: string; onClose: () => void }) => (
    <div data-testid="case-flow">
      <span data-testid="case-flow-start">{p.start}</span>
      <button onClick={p.onClose}>Закрыть разбор</button>
    </div>
  ),
}));
vi.mock('../components/HomeScreenOfferCard', () => ({ HomeScreenOfferCard: () => null }));

vi.mock('../api', () => ({
  api: {
    getProfile: vi.fn(),
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getGratitudeDiary: vi.fn(),
    history: vi.fn(),
    getTasks: vi.fn(),
    getTaskHistory: vi.fn(),
    completeTask: vi.fn(),
    createTask: vi.fn(),
    trackEvent: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue(undefined),
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
const ALL_RATED = { attachment: 6, autonomy: 6, expression: 6, play: 6, limits: 6 };

function profile(name: string | null = null) {
  return {
    name, role: 'CLIENT' as const,
    ysq: { completedAt: null, activeSchemaIds: [] },
    notifications: { enabled: false, reminderEnabled: false, timezone: 'UTC', localHour: 9 },
    streak: 0,
    lastActivity: { needsTracker: null, schemaDiary: null, modeDiary: null, gratitudeDiary: null },
    mySchemaIds: [], myModeIds: [],
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

const onNavigate = vi.fn();
const onOpenTracker = vi.fn();
const onOpenDiaries = vi.fn();
const onOpenTrackerHistory = vi.fn();

function renderSection(props: Partial<{ ratings: Record<string, number>; refreshKey: number }> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <TodaySection
          needs={NEEDS}
          ratings={props.ratings ?? {}}
          refreshKey={props.refreshKey}
          onNavigate={onNavigate}
          onOpenSchema={vi.fn()}
          onOpenAdvanced={vi.fn()}
          onOpenTracker={onOpenTracker}
          onOpenTrackerHistory={onOpenTrackerHistory}
          onOpenDiaries={onOpenDiaries}
          onOpenChildhoodWheel={vi.fn()}
        />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

const nowIso = () => new Date().toISOString();
const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Возвращающийся пользователь по умолчанию: «Зачем это всё» уже видел, лист не мешает.
  localStorage.setItem(WHY_SEEN_KEY, '1');
  mockApi.getProfile.mockResolvedValue(profile());
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getGratitudeDiary.mockResolvedValue([]);
  mockApi.history.mockResolvedValue([]);
  mockApi.getTasks.mockResolvedValue([]);
  mockApi.getTaskHistory.mockResolvedValue([]);
  mockApi.completeTask.mockResolvedValue(undefined);
  mockApi.createTask.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('TodaySection — пустой аккаунт: ничего выдуманного', () => {
  it('три плитки с честными подписями, пустая лента с подсказкой, блока заданий нет', async () => {
    renderSection();
    expect(screen.getByRole('button', { name: /Трекер/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Что случилось/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Дневник/ })).toBeTruthy();
    expect(screen.getByText('Ещё не заполнен · ≈1 мин')).toBeTruthy();
    expect(screen.getByText('≈3 мин · когда что-то зацепило')).toBeTruthy();
    await screen.findByText('Пока записей нет');
    expect(screen.getByText('Пока ничего. Любая кнопка выше подойдёт для начала.')).toBeTruthy();
    expect(screen.queryByText('От терапевта')).toBeNull();
    expect(screen.queryByText('Задания')).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('приветствие: с именем из профиля — «Привет, Анна», без имени — «Привет»', async () => {
    mockApi.getProfile.mockResolvedValue(profile('Анна Иванова'));
    renderSection();
    expect(await screen.findByRole('heading', { level: 1, name: 'Привет, Анна' })).toBeTruthy();
    cleanup();
    mockApi.getProfile.mockResolvedValue(profile(null));
    renderSection();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Привет');
  });

  it('пока дневники грузятся — скелетон ленты и плашка вместо подписи дневника, а не «Пока ничего»', () => {
    mockApi.getSchemaDiary.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.queryByText(/Пока ничего/)).toBeNull();
    expect(screen.queryByText('Пока записей нет')).toBeNull();
  });
});

describe('TodaySection — плитка трекера по реальным оценкам', () => {
  it('2 из 5 — «Заполнено 2 из 5 · продолжить» и одна строка в ленте', async () => {
    renderSection({ ratings: { attachment: 4, play: 7 } });
    expect(screen.getByText('Заполнено 2 из 5 · продолжить')).toBeTruthy();
    expect(await screen.findByText('Трекер: 2 из 5')).toBeTruthy();
  });

  it('все пять — «Готово · индекс 6,0», в ленте одна строка с индексом', async () => {
    renderSection({ ratings: ALL_RATED });
    expect(screen.getByText('Готово · индекс 6,0')).toBeTruthy();
    expect(await screen.findByText('Трекер заполнен — индекс 6,0')).toBeTruthy();
  });

  it('столбики окрашены только у оценённых потребностей', () => {
    const { container } = renderSection({ ratings: { attachment: 4 } });
    const bars = Array.from(container.querySelectorAll('.ct-bars > i')) as HTMLElement[];
    expect(bars).toHaveLength(5);
    expect(bars.filter(b => b.style.background !== '')).toHaveLength(1);
  });

  it('клик по плитке открывает трекер и шлёт home_tile', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Трекер/ }));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'tracker' });
  });

  it('строка трекера в ленте ведёт в историю', async () => {
    renderSection({ ratings: ALL_RATED });
    fireEvent.click(await screen.findByText('Трекер заполнен — индекс 6,0'));
    expect(onOpenTrackerHistory).toHaveBeenCalledTimes(1);
  });
});

describe('TodaySection — лента дня и плитка дневника', () => {
  it('записи за сегодня из трёх дневников: время, текст, тип; старые не показываются', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([
      { id: 1, trigger: 'ссора с коллегой', createdAt: nowIso() },
      { id: 2, trigger: 'старая запись', createdAt: daysAgoIso(4) },
    ]);
    mockApi.getModeDiary.mockResolvedValue([{ id: 3, situation: 'Критик громко', createdAt: nowIso() }]);
    renderSection();
    expect(await screen.findByText('ссора с коллегой')).toBeTruthy();
    expect(screen.getByText('Критик громко')).toBeTruthy();
    expect(screen.queryByText('старая запись')).toBeNull();
    expect(screen.getByText('Схема')).toBeTruthy();
    expect(screen.getByText('Режим')).toBeTruthy();
    expect(screen.getByText('Сегодня 2 записи')).toBeTruthy();
  });

  it('записей сегодня нет, но есть старые — «Последняя запись — …»', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([{ id: 2, trigger: 'старая', createdAt: daysAgoIso(1.4) }]);
    renderSection();
    expect(await screen.findByText('Последняя запись — вчера')).toBeTruthy();
  });

  it('в дневнике режимов есть запись за сегодня — плитка «Что случилось» без счёта, только обещание', async () => {
    mockApi.getModeDiary.mockResolvedValue([{ id: 3, situation: 'запись', createdAt: nowIso() }]);
    renderSection();
    expect(await screen.findByText('Сегодня 1 запись')).toBeTruthy();
    expect(screen.getByText('≈3 мин · когда что-то зацепило')).toBeTruthy();
    expect(screen.queryByText(/Сегодня разобран/)).toBeNull();
  });

  it('плитка дневника открывает «Дневник одной страницей», а не список дневников; строка ленты — список', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([{ id: 1, trigger: 'строка ленты', createdAt: nowIso() }]);
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Дневник/ }));
    expect(screen.getByRole('heading', { name: 'Что на уме?' })).toBeTruthy();
    expect(onOpenDiaries).not.toHaveBeenCalled();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'diary' });
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Что на уме?' })).toBeNull());
    fireEvent.click(await screen.findByText('строка ленты'));
    expect(onOpenDiaries).toHaveBeenCalledTimes(1);
  });

  it('«Все записи» ведёт в «Записи», «Подышим» — в практики; оба считаются', () => {
    renderSection();
    fireEvent.click(screen.getByText('Все записи'));
    expect(onNavigate).toHaveBeenLastCalledWith('diary');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'feed_all' });
    fireEvent.click(screen.getByText('Тяжело прямо сейчас? Подышим →'));
    expect(onNavigate).toHaveBeenLastCalledWith('practice');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'calm' });
  });

  it('сбой любого дневника не роняет экран и уходит в отчёт', async () => {
    mockApi.getSchemaDiary.mockRejectedValue(new Error('500'));
    renderSection();
    await waitFor(() => expect(mockReport).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Дневник/ })).toBeTruthy();
  });

  it('refreshKey: смена ключа перечитывает дневники (сохранил → нашёл)', async () => {
    const view = renderSection({ refreshKey: 0 });
    await screen.findByText('Пока записей нет');
    mockApi.getSchemaDiary.mockResolvedValue([{ id: 1, trigger: 'новая запись', createdAt: nowIso() }]);
    view.rerender(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <TodaySection needs={NEEDS} ratings={{}} refreshKey={1} onNavigate={onNavigate} onOpenSchema={vi.fn()}
            onOpenAdvanced={vi.fn()} onOpenTracker={onOpenTracker} onOpenDiaries={onOpenDiaries} onOpenChildhoodWheel={vi.fn()} />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    expect(await screen.findByText('новая запись')).toBeTruthy();
  });
});

describe('TodaySection — «Что случилось»', () => {
  it('плитка открывает поток; закрытие перечитывает дневники, плитка считает разбор за сегодня', async () => {
    mockApi.getModeDiary.mockResolvedValue([{ id: 1, situation: 'давний', createdAt: daysAgoIso(3) }]);
    renderSection();
    await screen.findByText('Последняя запись — 3 дн. назад');
    fireEvent.click(screen.getByRole('button', { name: /Что случилось/ }));
    expect((await screen.findByTestId('case-flow-start')).textContent).toBe('flow');
    expect(screen.getByText('≈3 мин · когда что-то зацепило')).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'case' });

    mockApi.getModeDiary.mockResolvedValue([
      { id: 1, situation: 'давний', createdAt: daysAgoIso(3) },
      { id: 2, situation: 'только что', createdAt: nowIso(), fromCase: true },
    ]);
    fireEvent.click(screen.getByText('Закрыть разбор'));
    await waitFor(() => expect(screen.queryByTestId('case-flow')).toBeNull());
    expect(await screen.findByText('только что')).toBeTruthy();
    expect(screen.getByText('Сегодня: 1 разбор')).toBeTruthy();
    expect(screen.getByText('Разбор')).toBeTruthy();
  });
});

describe('TodaySection — «Зачем это?» и первый вход', () => {
  it('новичку лист открывается сам один раз, после «Понятно» — флаг и больше не появляется', async () => {
    localStorage.removeItem(WHY_SEEN_KEY);
    renderSection();
    expect(await screen.findByText('Первый раз здесь')).toBeTruthy();
    await act(async () => { await Promise.resolve(); }); // запись истории листа успевает лечь до клика
    fireEvent.click(screen.getByText('Понятно, начнём'));
    await waitFor(() => expect(screen.queryByText('Первый раз здесь')).toBeNull());
    expect(localStorage.getItem(WHY_SEEN_KEY)).toBe('1');
    cleanup();
    renderSection();
    await screen.findByText('Пока записей нет');
    expect(screen.queryByText('Первый раз здесь')).toBeNull();
  });

  it('пока профиль не загрузился, лист не показывается (не мигает поверх скелетона)', () => {
    localStorage.removeItem(WHY_SEEN_KEY);
    mockApi.getProfile.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.queryByText('Первый раз здесь')).toBeNull();
  });

  it('у кого уже есть оценки или записи, лист сам не открывается', async () => {
    localStorage.removeItem(WHY_SEEN_KEY);
    mockApi.getSchemaDiary.mockResolvedValue([{ id: 1, trigger: 'давно', createdAt: daysAgoIso(30) }]);
    renderSection();
    await screen.findByText(/Последняя запись/);
    expect(screen.queryByText('Первый раз здесь')).toBeNull();
  });

  it('кнопка «Зачем это?» открывает лист с другой подписью и считается', async () => {
    renderSection();
    fireEvent.click(screen.getByText('Зачем это?'));
    expect(await screen.findByText('Три вещи, которые здесь можно делать')).toBeTruthy();
    expect(screen.getByText('Зачем это всё')).toBeTruthy();
    expect(screen.queryByText('Первый раз здесь')).toBeNull();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'why' });
  });
});

describe('TodaySection — задания терапевта', () => {
  it('назначенное задание — блок «От терапевта»; выполненное помечено и без «начать →»', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 1, assignedBy: 9, text: 'Письмо', done: null }), task({ id: 2, assignedBy: 9, text: 'Сделанное', done: true })]);
    renderSection();
    expect(await screen.findByText('От терапевта', { selector: 'h3' })).toBeTruthy();
    const section = screen.getByText('От терапевта', { selector: 'h3' }).closest('.ct-section') as HTMLElement;
    expect(within(section).getAllByText('начать →')).toHaveLength(1);
  });

  it('только свои цели — блок «Задания»; без заданий блока нет', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 1, assignedBy: null, text: 'Моя цель' })]);
    renderSection();
    expect(await screen.findByText('Задания')).toBeTruthy();
    expect(screen.queryByText('От терапевта', { selector: 'h3' })).toBeNull();
  });

  it('активные задачи считаются и открывают оверлей «Все задания» при >5', async () => {
    mockApi.getTasks.mockResolvedValue(Array.from({ length: 6 }, (_, i) => task({ id: i + 1, text: `Задача ${i + 1}` })));
    renderSection();
    await screen.findByText('6 активных');
    fireEvent.click(screen.getByText('Все задания (6) →'));
    await screen.findByText('Все задания');
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

  async function clickTaskStart() {
    const heading = await screen.findByText('Задания');
    const section = heading.closest('.ct-section')!;
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
    await screen.findByText('Все задания');
    fireEvent.click(document.querySelector('.sk-overlay .sk-wide-btn')!);

    await screen.findByText('Новое задание');
  });
});

// ── Регрессия «момент, показанный по Гринвичу» ───────────────────────────────
// Зеркало инцидента 2026-09-17: МОМЕНТ записи резали строкой — гринвичский день
// сравнивался с локальным. Проверка замораживает «сейчас» на моментах, где
// гринвичский день и локальный заведомо разные, и сама обходит зоны.
describe('TodaySection — день и время записи в зоне читателя', () => {
  const MOMENTS = ['2026-09-18T23:30:00.000Z', '2026-09-19T00:30:00.000Z'];

  for (const iso of MOMENTS) {
    it(`запись, сделанная в ${iso}, попадает в ленту «Сегодня» с локальным временем`, async () => {
      await forEachTimeZoneAsync(async tz => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(iso));
        try {
          mockApi.getSchemaDiary.mockResolvedValue([{ id: 1, trigger: 'ссора с коллегой', createdAt: iso }]);
          renderSection();
          await screen.findByText('ссора с коллегой');
          const at = new Date(iso);
          const hhmm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
          expect(screen.getByText(hhmm), tz).toBeTruthy();
        } finally {
          cleanup();
          vi.useRealTimers();
        }
      });
    });
  }
});

// ── Мост к терапевту ─────────────────────────────────────────────────────────
describe('TodaySection — мост к терапевту', () => {
  const lowDays = ['26', '25', '24', '23', '22'].map(d => ({
    date: `2026-10-${d}`,
    ratings: { attachment: 3, autonomy: 3, expression: 3, play: 3, limits: 3 },
  }));

  it('внизу страницы тихая строка «самопомощь, не замена терапии» со ссылкой «Поговорить →»', async () => {
    renderSection();
    const line = await screen.findByText(/Приложение — самопомощь, не замена терапии/);
    expect(line.textContent).toContain('Если нужна терапия, есть с кем поговорить.');
    expect(screen.getByRole('button', { name: 'Поговорить →' })).toBeTruthy();
    // Нет сигнала — нет карточки.
    expect(screen.queryByText('Не сейчас')).toBeNull();
  });

  it('сигнал по трём низким дням: карточка стоит над лентой дня', async () => {
    mockApi.history.mockResolvedValue(lowDays);
    renderSection();
    const eyebrow = await screen.findByText('Три последних заполненных дня: индекс не выше 4');
    const feedTitle = document.querySelector('.ct-feed')!;
    expect(eyebrow.compareDocumentPosition(feedTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Не сейчас' }));
    expect(screen.queryByText('Три последних заполненных дня: индекс не выше 4')).toBeNull();
  });

  it('записи режимов из дневника доходят до сигнала: три раза один режим', async () => {
    mockApi.history.mockResolvedValue([6, 5, 4, 3, 2].map(i => ({ date: `2026-10-0${i}`, ratings: { attachment: 7, autonomy: 7, expression: 7, play: 7, limits: 7 } })));
    mockApi.getModeDiary.mockResolvedValue([1, 2, 3].map(i => ({ id: i, modeId: 'punitive_critic', situation: 'x', createdAt: daysAgoIso(i) })));
    renderSection();
    expect(await screen.findByText(/3 раза за две недели/)).toBeTruthy();
  });
});
