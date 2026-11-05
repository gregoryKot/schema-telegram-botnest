// @vitest-environment jsdom
// Главная «Сегодня»: три плитки (трекер / Что случилось / дневник) и «Зачем это?»,
// больше ничего (владелец 2026-11-05). Задания — sections/tasks/TasksHub.test.tsx,
// мост к терапевту — MoreSection.test.tsx. Только реальные данные: на чистом
// аккаунте — «Ещё не заполнен», а не выдуманные цифры.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { TodaySection } from './TodaySection';
import { WHY_SEEN_KEY } from './today/whySeen';

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

// Упражнения, которые открывают задания (TaskExerciseHost): заглушка с
// «Назад» и «Сохранить», чтобы видеть, ЧТО открылось и закрылось ли задание.
const exStub = (id: string) => (p: { onBack?: () => void; onClose?: () => void; onComplete?: () => void }) => (
  <div data-testid={id}>
    <button onClick={p.onBack ?? p.onClose}>Назад</button>
    <button onClick={() => p.onComplete?.()}>Сохранить упражнение</button>
  </div>
);
vi.mock('../components/exercises/BeliefCheckEx', () => ({ BeliefCheckEx: exStub('belief-ex') }));
vi.mock('../components/exercises/LetterEx', () => ({ LetterEx: exStub('letter-ex') }));
vi.mock('../components/exercises/SafePlaceEx', () => ({ SafePlaceEx: exStub('safe-ex') }));
vi.mock('../components/SchemaFlashcard', () => ({ SchemaFlashcard: exStub('flashcard-ex') }));

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

const onOpenTracker = vi.fn();

function renderSection(props: Partial<{ ratings: Record<string, number>; refreshKey: number }> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <TodaySection
          needs={NEEDS}
          ratings={props.ratings ?? {}}
          refreshKey={props.refreshKey}
          onOpenSchema={vi.fn()}
          onOpenTracker={onOpenTracker}
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
  it('три плитки с честными подписями и больше ничего: ни ленты, ни заданий, ни «Подышим»', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 1, assignedBy: 9, type: 'custom', text: 'Задание терапевта' })]);
    renderSection();
    expect(screen.getByRole('button', { name: /Трекер/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Что случилось/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Дневник/ })).toBeTruthy();
    expect(screen.getByText('Ещё не заполнен · ≈1 мин')).toBeTruthy();
    expect(screen.getByText('≈3 мин')).toBeTruthy();
    await screen.findByText('Пока записей нет');
    expect(screen.getAllByRole('button')).toHaveLength(4); // три плитки и «Зачем это?»
    expect(screen.queryByText(/Пока ничего/)).toBeNull();
    expect(screen.queryByText('Задание терапевта')).toBeNull();
    expect(screen.queryByText(/Подышим/)).toBeNull();
    expect(screen.queryByText(/самопомощь, не замена терапии/)).toBeNull();
    expect(mockApi.getTasks).not.toHaveBeenCalled();
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

  it('пока дневники грузятся — плашка вместо подписи дневника, а не выдуманная подпись', () => {
    mockApi.getSchemaDiary.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.queryByText('Пока записей нет')).toBeNull();
    expect(document.querySelector('.pp-meta--skeleton')).toBeTruthy();
  });
});

describe('TodaySection — плитка трекера по реальным оценкам', () => {
  it('2 из 5 — «Заполнено 2 из 5 · продолжить»', () => {
    renderSection({ ratings: { attachment: 4, play: 7 } });
    expect(screen.getByText('Заполнено 2 из 5 · продолжить')).toBeTruthy();
    expect(screen.getByText('Продолжить →')).toBeTruthy();
  });

  it('все пять — «Готово · индекс 6,0»', () => {
    renderSection({ ratings: ALL_RATED });
    expect(screen.getByText('Готово · индекс 6,0')).toBeTruthy();
    expect(screen.getByText('Посмотреть сегодня →')).toBeTruthy();
  });

  it('полоски картинки плотные только у оценённых потребностей', () => {
    const { container } = renderSection({ ratings: { attachment: 4 } });
    const strokes = container.querySelectorAll('.ct-main [data-need]');
    expect(strokes).toHaveLength(5);
    expect(container.querySelectorAll('.ct-main [data-rated="yes"]')).toHaveLength(1);
  });

  it('клик по плитке открывает трекер и шлёт home_tile', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Трекер/ }));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'tracker' });
  });

});

describe('TodaySection — плитка дневника', () => {
  it('в дневнике режимов есть запись за сегодня — плитка «Что случилось» без счёта, только обещание', async () => {
    mockApi.getModeDiary.mockResolvedValue([{ id: 3, situation: 'запись', createdAt: nowIso() }]);
    renderSection();
    expect(await screen.findByText('Сегодня 1 запись')).toBeTruthy();
    expect(screen.getByText('≈3 мин')).toBeTruthy();
    expect(screen.queryByText(/Сегодня разобран/)).toBeNull();
  });

  it('плитка дневника открывает «Дневник одной страницей», а не список дневников', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Дневник/ }));
    expect(screen.getByRole('heading', { name: 'Что на уме?' })).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'diary' });
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Что на уме?' })).toBeNull());
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
    mockApi.getSchemaDiary.mockResolvedValue([{ id: 1, trigger: 'новая запись', schemaIds: ['abandonment'], emotions: [], createdAt: nowIso() }]);
    view.rerender(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <TodaySection needs={NEEDS} ratings={{}} refreshKey={1} onOpenSchema={vi.fn()} onOpenTracker={onOpenTracker} />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    expect(await screen.findByText('Сегодня 1 запись')).toBeTruthy();
  });
});

describe('TodaySection — «Что случилось»', () => {
  it('плитка открывает поток; закрытие перечитывает дневники, плитка считает разбор за сегодня', async () => {
    mockApi.getModeDiary.mockResolvedValue([{ id: 1, situation: 'давний', createdAt: daysAgoIso(3) }]);
    renderSection();
    await screen.findByText('Последняя запись — 3 дн. назад');
    fireEvent.click(screen.getByRole('button', { name: /Что случилось/ }));
    expect((await screen.findByTestId('case-flow-start')).textContent).toBe('flow');
    expect(screen.getByText('≈3 мин')).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'case' });

    mockApi.getModeDiary.mockResolvedValue([
      { id: 1, situation: 'давний', createdAt: daysAgoIso(3) },
      { id: 2, situation: 'только что', createdAt: nowIso(), fromCase: true },
    ]);
    fireEvent.click(screen.getByText('Закрыть разбор'));
    await waitFor(() => expect(screen.queryByTestId('case-flow')).toBeNull());
    expect(await screen.findByText('Сегодня: 1 разбор')).toBeTruthy();
    // QA 2026-11, М1: разбор — не запись дневника; «Записи» относят его к «Случаям».
    expect(screen.getByText('Последняя запись — 3 дн. назад')).toBeTruthy();
    expect(screen.queryByText('Сегодня 1 запись')).toBeNull();
  });

  // QA 2026-11, М1: «Просто мысль» на главной была «Схема», в «Записях» — «Мысль».
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
    mockApi.getSchemaDiary.mockResolvedValue([{ id: 1, trigger: 'давно', schemaIds: ['abandonment'], emotions: [], createdAt: daysAgoIso(30) }]);
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






