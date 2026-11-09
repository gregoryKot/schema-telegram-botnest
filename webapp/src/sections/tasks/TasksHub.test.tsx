// @vitest-environment jsdom
// Узел заданий (переехал с главной на «Ещё», владелец 2026-11-05): список всех
// заданий, каждый тип «начать →» открывает свой экран, «Готово» закрывает задание,
// «+ Поставить цель» открывает создание; узел закрывается, когда закрыто всё.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';
import { TasksHub } from './TasksHub';

vi.mock('../../components/exercises/FlashcardEx', () => ({
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
const exStub = (id: string) => (p: { onBack?: () => void; onClose?: () => void; onComplete?: () => void }) => (
  <div data-testid={id}>
    <button onClick={p.onBack ?? p.onClose}>Назад</button>
    <button onClick={() => p.onComplete?.()}>Сохранить упражнение</button>
  </div>
);
vi.mock('../../components/exercises/BeliefCheckEx', () => ({ BeliefCheckEx: exStub('belief-ex') }));
vi.mock('../../components/exercises/LetterEx', () => ({ LetterEx: exStub('letter-ex') }));
vi.mock('../../components/exercises/SafePlaceEx', () => ({ SafePlaceEx: exStub('safe-ex') }));
vi.mock('../../components/SchemaFlashcard', () => ({ SchemaFlashcard: exStub('flashcard-ex') }));

vi.mock('../../api', () => ({
  api: {
    getTasks: vi.fn(), getTaskHistory: vi.fn(), completeTask: vi.fn(), createTask: vi.fn(), trackEvent: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue(undefined),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function task(overrides: Partial<{ id: number; assignedBy: number | null; type: string; text: string; done: boolean | null }> = {}) {
  return {
    id: 1, userId: 1, assignedBy: null, type: 'custom', text: 'Задание',
    targetDays: null, needId: null, dueDate: null, done: null,
    completedAt: null, createdAt: '2026-08-01T00:00:00Z', doneToday: false,
    ...overrides,
  };
}

function renderHub(overrides: Partial<{ onOpenTracker: () => void; onOpenDiaries: () => void; onOpenChildhoodWheel: () => void; onClose: () => void }> = {}) {
  return render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
      <MemoryRouter>
        <TasksHub
          onClose={overrides.onClose ?? vi.fn()}
          onOpenTracker={overrides.onOpenTracker ?? vi.fn()}
          onOpenDiaries={overrides.onOpenDiaries ?? vi.fn()}
          onOpenChildhoodWheel={overrides.onOpenChildhoodWheel ?? vi.fn()}
        />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

async function clickStart() {
  const overlay = (await screen.findByText('Задания', { selector: 'h1' })).closest('.sk-overlay') as HTMLElement;
  await act(async () => {});
  fireEvent.click(within(overlay).getByText(/^(начать|открыть) →$/));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTasks.mockResolvedValue([]);
  mockApi.getTaskHistory.mockResolvedValue([]);
  mockApi.completeTask.mockResolvedValue({ ok: true });
  mockApi.createTask.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('TasksHub — список', () => {
  it('открывается списком «Задания» со всеми заданиями; закрытие списка закрывает узел', async () => {
    const onClose = vi.fn();
    mockApi.getTasks.mockResolvedValue(Array.from({ length: 6 }, (_, i) => task({ id: i + 1, text: `Задача ${i + 1}` })));
    renderHub({ onClose });
    await screen.findByText('Задания', { selector: 'h1' });
    expect(await screen.findByText('Задача 6')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Назад|Закрыть/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('«Готово» у назначенной custom-задачи вызывает completeTask', async () => {
    mockApi.getTasks.mockResolvedValueOnce([task({ id: 1, assignedBy: 9, type: 'custom', text: 'Позвонить маме' })]).mockResolvedValue([]);
    renderHub();
    await screen.findByText('Позвонить маме');
    fireEvent.click(screen.getAllByText('Готово')[0]);
    await waitFor(() => expect(mockApi.completeTask).toHaveBeenCalledWith(1, true));
  });

  // До 2026-11 узел не брал taskError из useTaskActions: отказ «Готово» и новой
  // цели проходил молча (нашлось при разборе no-floating-promises в webapp).
  it('«Готово» отклонено сервером — в списке видна ошибка, задание на месте', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 1, assignedBy: 9, type: 'custom', text: 'Позвонить маме' })]);
    mockApi.completeTask.mockRejectedValue(new Error('500'));
    renderHub();
    await screen.findByText('Позвонить маме');
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => { fireEvent.click(screen.getAllByText('Готово')[0]); });
    expect(screen.getByRole('alert').textContent).toContain('Не удалось сохранить изменение задания');
    expect(screen.getByText('Позвонить маме')).toBeTruthy();
  });

  it('новая цель создана, а список не перечитался — после возврата к списку видна ошибка', async () => {
    mockApi.getTasks.mockResolvedValueOnce([]).mockRejectedValue(new Error('503'));
    renderHub();
    await screen.findByText('Задания', { selector: 'h1' });
    await act(async () => {});
    fireEvent.click(document.querySelector('.sk-overlay .sk-wide-btn')!);
    await screen.findByText('Новая цель');
    // Тип по умолчанию — «серия в трекере», текста не требует.
    await act(async () => { fireEvent.click(document.querySelector('.sk-submit .ds-btn')!); });
    expect(mockApi.createTask).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole('alert')).textContent).toContain('Не удалось сохранить изменение задания');
    expect(await screen.findByText('Задания', { selector: 'h1' })).toBeTruthy();
  });

  it('«+ Поставить цель» открывает создание цели вместо списка; «Назад» возвращает список, узел не закрывается', async () => {
    const onClose = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ type: 'diary_streak', text: 'Дневник 7 дней' })]);
    renderHub({ onClose });
    await screen.findByText('Дневник 7 дней');
    fireEvent.click(document.querySelector('.sk-overlay .sk-wide-btn')!);
    await screen.findByText('Новая цель');
    expect(screen.queryByText('Задания', { selector: 'h1' })).toBeNull();
    fireEvent.click(screen.getByText('Назад'));
    await waitFor(() => expect(screen.queryByText('Новая цель')).toBeNull());
    expect(await screen.findByText('Задания', { selector: 'h1' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('TasksHub — каждый тип «начать →» открывает свой экран', () => {
  it('tracker_streak → onOpenTracker', async () => {
    const onOpenTracker = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ type: 'tracker_streak', text: 'Трекать 7 дней' })]);
    renderHub({ onOpenTracker });
    await clickStart();
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });
  it('diary_streak → onOpenDiaries', async () => {
    const onOpenDiaries = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ type: 'diary_streak', text: 'Дневник 7 дней' })]);
    renderHub({ onOpenDiaries });
    await clickStart();
    expect(onOpenDiaries).toHaveBeenCalledTimes(1);
  });
  it('childhood_wheel → onOpenChildhoodWheel', async () => {
    const onOpenChildhoodWheel = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ type: 'childhood_wheel', text: 'Колесо детства' })]);
    renderHub({ onOpenChildhoodWheel });
    await clickStart();
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });

  // Инцидент 2026-10-26 (docs/INCIDENTS.md): три упражнения открывали настройки.
  it.each([
    ['belief_check', 'Проверить убеждение', 'belief-ex'],
    ['letter_to_self', 'Написать письмо себе в детстве', 'letter-ex'],
    ['safe_place', 'Описать Безопасное место', 'safe-ex'],
    ['flashcard', 'Разобрать сложную ситуацию по шагам', 'flashcard-ex'],
  ])('%s → своё упражнение; сохранение закрывает задание', async (type, text, testId) => {
    mockApi.getTasks.mockResolvedValue([task({ id: 7, assignedBy: 9, type, text })]);
    renderHub();
    await clickStart();
    expect(await screen.findByTestId(testId)).toBeTruthy();
    expect(screen.queryByText('Задания', { selector: 'h1' })).toBeNull();
    fireEvent.click(screen.getByText('Сохранить упражнение'));
    await waitFor(() => expect(mockApi.completeTask).toHaveBeenCalledWith(7, true));
  });

  it('schema_intro → карточка схемы с id из задания; «Назад» закрывает без завершения и возвращает список', async () => {
    const onClose = vi.fn();
    mockApi.getTasks.mockResolvedValue([task({ id: 5, type: 'schema_intro', text: 'abandonment' })]);
    renderHub({ onClose });
    await clickStart();
    expect((await screen.findByTestId('schema-ex-id')).textContent).toBe('abandonment');
    fireEvent.click(screen.getByText('Назад'));
    await waitFor(() => expect(screen.queryByTestId('schema-ex')).toBeNull());
    expect(mockApi.completeTask).not.toHaveBeenCalled();
    expect(await screen.findByText('Задания', { selector: 'h1' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mode_intro → карточка режима; завершение вызывает completeTask', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 6, type: 'mode_intro', text: 'vulnerable_child' })]);
    renderHub();
    await clickStart();
    expect((await screen.findByTestId('mode-ex-id')).textContent).toBe('vulnerable_child');
    fireEvent.click(screen.getByText('Завершить карточку режима'));
    await waitFor(() => expect(mockApi.completeTask).toHaveBeenCalledWith(6, true));
  });
});
