// @vitest-environment jsdom
// Аудит 2026-11, U2: кнопка «Терапевт назначил задание» вела на «Сегодня», где
// заданий нет. Теперь ссылка `tasks_<id>` открывает «Задания» в «Ещё» и само
// задание; что лежит в узле, человек увидел — счётчик новых гаснет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';
import { TasksHub } from './TasksHub';
import { TASKS_SEEN_KEY } from './newTasks';

const exStub = (id: string) => (p: { onBack?: () => void }) => (
  <div data-testid={id}><button onClick={p.onBack}>Назад</button></div>
);
vi.mock('../../components/exercises/LetterEx', () => ({ LetterEx: exStub('letter-ex') }));

vi.mock('../../api', () => ({
  api: {
    getTasks: vi.fn(), getTaskHistory: vi.fn(), completeTask: vi.fn(), createTask: vi.fn(), trackEvent: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue(undefined),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const task = (o: { id: number; type: string; text: string; assignedBy?: number | null; createdAt?: string }) => ({
  userId: 1, assignedBy: 9, targetDays: null, needId: null, dueDate: null, done: null,
  completedAt: null, createdAt: '2026-11-01T10:00:00.000Z', doneToday: false, ...o,
});

function renderHub(openTaskId?: number, onClose = vi.fn()) {
  render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
      <MemoryRouter>
        <TasksHub openTaskId={openTaskId} onClose={onClose} onOpenTracker={vi.fn()} onOpenDiaries={vi.fn()} onOpenChildhoodWheel={vi.fn()} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getTaskHistory.mockResolvedValue([]);
});
afterEach(cleanup);

describe('TasksHub по ссылке из уведомления', () => {
  it('задание с листом открывается сразу; «Назад» — к списку, узел не закрывается', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 7, type: 'letter_to_self', text: '' })]);
    const onClose = renderHub(7);
    expect(await screen.findByTestId('letter-ex')).toBeTruthy();
    expect(screen.queryByText('Задания', { selector: 'h1' })).toBeNull();
    fireEvent.click(screen.getByText('Назад'));
    expect(await screen.findByText('Задания', { selector: 'h1' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('«Своё задание» открывать нечем — показывается список, где оно есть', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 3, type: 'custom', text: 'Позвонить маме' })]);
    renderHub(3);
    expect(await screen.findByText('Задания', { selector: 'h1' })).toBeTruthy();
    expect(screen.getByText('Позвонить маме')).toBeTruthy();
  });

  it('задания уже нет (выполнено или удалено) — список, а не пустой экран', async () => {
    mockApi.getTasks.mockResolvedValue([task({ id: 1, type: 'custom', text: 'Другое' })]);
    const onClose = renderHub(99);
    expect(await screen.findByText('Задания', { selector: 'h1' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('список не загрузился — всё равно список, узел не схлопывается', async () => {
    mockApi.getTasks.mockRejectedValue(new Error('network down'));
    const onClose = renderHub(7);
    expect(await screen.findByText('Задания', { selector: 'h1' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('TasksHub гасит счётчик новых', () => {
  it('открыл «Задания» — отметка = самое позднее назначение терапевта', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 1, type: 'custom', text: 'Старое', createdAt: '2026-11-01T10:00:00.000Z' }),
      task({ id: 2, type: 'custom', text: 'Новое', createdAt: '2026-11-05T08:00:00.000Z' }),
      task({ id: 3, type: 'custom', text: 'Своя цель', assignedBy: null, createdAt: '2026-11-07T08:00:00.000Z' }),
    ]);
    renderHub();
    await screen.findByText('Новое');
    await waitFor(() => expect(localStorage.getItem(TASKS_SEEN_KEY)).toBe('2026-11-05T08:00:00.000Z'));
  });
});
