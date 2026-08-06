// @vitest-environment jsdom
// TherapistClientSheet — контейнер кабинета терапевта (0% покрытия): грузит
// список клиентов, переключает list/client, монтирует оверлеи (Tasks/Notes/
// Concept/ClientNotes/TaskCreateSheet) по флагам детейл-хука, и держит
// backHandlerRef для аппаратной кнопки «Назад» — каскад закрытия оверлеев
// прежде чем уйти на список. Дочерние *View/*Sheet уже покрыты своими
// тестами — здесь мокаем их и проверяем только проводку контейнера.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { useRef, useState } from 'react';
import { TherapistClientSheet } from './TherapistClientSheet';
import type { TherapyClientSummary } from '../api';

vi.mock('../api', () => ({
  api: {
    getTherapyClients: vi.fn(),
    getTherapyTasksForClient: vi.fn(),
    getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(),
    getClientModeNotes: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./therapistClientSheet/ClientListView', () => ({
  ClientListView: ({ clients, loading, onClose, detail }: any) => (
    <div data-testid="list-view">
      <span>{loading ? 'Загрузка' : `Клиентов: ${clients.length}`}</span>
      <button onClick={onClose}>close-sheet</button>
      {clients[0] && (
        <button onClick={() => detail.openClient(clients[0])}>
          open-{clients[0].telegramId}
        </button>
      )}
    </div>
  ),
}));

vi.mock('./therapistClientSheet/ClientDetailView', () => ({
  ClientDetailView: ({ selectedClient, detail }: any) => (
    <div data-testid="detail-view">
      <span>Клиент: {selectedClient.name}</span>
      <span>Задач: {detail.clientTasks.length}</span>
      <button onClick={() => detail.setShowTasksSheet(true)}>open-tasks</button>
      <button onClick={() => detail.setShowNotesSheet(true)}>open-notes</button>
      <button onClick={() => detail.setShowConceptSheet(true)}>
        open-concept
      </button>
      <button onClick={() => detail.setShowClientNotesSheet(true)}>
        open-client-notes
      </button>
      <button onClick={() => detail.setShowAssign(true)}>open-assign</button>
    </div>
  ),
}));

vi.mock('./therapistClientSheet/TasksSheet', () => ({
  TasksSheet: () => <div data-testid="tasks-sheet">tasks-sheet</div>,
}));
vi.mock('./therapistClientSheet/NotesSheet', () => ({
  NotesSheet: () => <div data-testid="notes-sheet">notes-sheet</div>,
}));
vi.mock('./therapistClientSheet/ConceptSheet', () => ({
  ConceptSheet: () => <div data-testid="concept-sheet">concept-sheet</div>,
}));
vi.mock('./therapistClientSheet/ClientNotesSheet', () => ({
  ClientNotesSheet: () => (
    <div data-testid="client-notes-sheet">client-notes-sheet</div>
  ),
}));
vi.mock('./TaskCreateSheet', () => ({
  TaskCreateSheet: ({ clientId, clientName, onCreated, onClose }: any) => (
    <div data-testid="task-create-sheet">
      <span>Для: {clientName ?? clientId}</span>
      <button onClick={onCreated}>create-task</button>
      <button onClick={onClose}>close-assign</button>
    </div>
  ),
}));

const client: TherapyClientSummary = {
  telegramId: 501,
  name: 'Ирина',
  clientAlias: null,
  streak: 2,
  lastActiveDate: null,
  todayIndex: null,
  recentIndexHistory: [],
  relationCreatedAt: '2026-01-01',
  therapyStartDate: null,
  nextSession: null,
  meetingDays: [],
  schemaIds: [],
};

// Контролируемая обёртка: view/onViewChange живут у "родителя" (как в App.tsx).
function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [view, setView] = useState<'list' | 'client'>('list');
  const backHandlerRef = useRef<() => void>(() => {});
  return (
    <div>
      <button onClick={() => backHandlerRef.current()}>fire-back</button>
      <TherapistClientSheet
        view={view}
        onViewChange={setView}
        onClose={onClose}
        backHandlerRef={backHandlerRef}
      />
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyClients.mockResolvedValue([client]);
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue([]);
  mockApi.getConceptualization.mockResolvedValue(null);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
});
afterEach(cleanup);

describe('TherapistClientSheet — загрузка списка клиентов', () => {
  it('показывает загрузку, затем реальный список из api.getTherapyClients', async () => {
    render(<Harness />);
    expect(screen.getByText('Загрузка')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Клиентов: 1')).toBeTruthy());
    expect(mockApi.getTherapyClients).toHaveBeenCalledTimes(1);
  });

  it('ошибка api.getTherapyClients — список остаётся пустым, не крашится', async () => {
    mockApi.getTherapyClients.mockRejectedValue(new Error('network'));
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('Клиентов: 0')).toBeTruthy());
  });

  it('onClose из ClientListView зовёт переданный проп onClose', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Клиентов: 1')).toBeTruthy());
    fireEvent.click(screen.getByText('close-sheet'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('TherapistClientSheet — переход list → client', () => {
  it('открытие клиента переключает на ClientDetailView с его именем', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('open-501')).toBeTruthy());
    fireEvent.click(screen.getByText('open-501'));
    await waitFor(() => expect(screen.getByText('Клиент: Ирина')).toBeTruthy());
    expect(mockApi.getTherapyTasksForClient).toHaveBeenCalledWith(501);
  });
});

describe('TherapistClientSheet — оверлеи по флагам detail', () => {
  async function openClientView() {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('open-501')).toBeTruthy());
    fireEvent.click(screen.getByText('open-501'));
    await waitFor(() => expect(screen.getByText('Клиент: Ирина')).toBeTruthy());
  }

  it('showTasksSheet=true монтирует TasksSheet', async () => {
    await openClientView();
    fireEvent.click(screen.getByText('open-tasks'));
    expect(screen.getByTestId('tasks-sheet')).toBeTruthy();
  });

  it('showNotesSheet=true монтирует NotesSheet', async () => {
    await openClientView();
    fireEvent.click(screen.getByText('open-notes'));
    expect(screen.getByTestId('notes-sheet')).toBeTruthy();
  });

  it('showConceptSheet=true монтирует ConceptSheet', async () => {
    await openClientView();
    fireEvent.click(screen.getByText('open-concept'));
    expect(screen.getByTestId('concept-sheet')).toBeTruthy();
  });

  it('showClientNotesSheet=true монтирует ClientNotesSheet', async () => {
    await openClientView();
    fireEvent.click(screen.getByText('open-client-notes'));
    expect(screen.getByTestId('client-notes-sheet')).toBeTruthy();
  });

  it('showAssign=true монтирует TaskCreateSheet с именем клиента', async () => {
    await openClientView();
    fireEvent.click(screen.getByText('open-assign'));
    expect(screen.getByText('Для: Ирина')).toBeTruthy();
  });
});

describe('TherapistClientSheet — TaskCreateSheet: создание задачи', () => {
  it('создание задачи закрывает лист и перечитывает задачи клиента', async () => {
    mockApi.getTherapyTasksForClient
      .mockResolvedValueOnce([]) // при openClient
      .mockResolvedValueOnce([
        { id: 9, title: 'Дневник', done: false } as unknown,
      ]);
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('open-501')).toBeTruthy());
    fireEvent.click(screen.getByText('open-501'));
    await waitFor(() => expect(screen.getByText('open-assign')).toBeTruthy());
    fireEvent.click(screen.getByText('open-assign'));
    expect(screen.getByTestId('task-create-sheet')).toBeTruthy();

    fireEvent.click(screen.getByText('create-task'));

    await waitFor(() =>
      expect(screen.queryByTestId('task-create-sheet')).toBeNull(),
    );
    await waitFor(() => expect(screen.getByText('Задач: 1')).toBeTruthy());
  });

  it('регрессия: сбой перечитывания задач после создания НЕ стирает уже загруженный список', async () => {
    // Баг был: onCreated делал .catch(() => []) — сетевой сбой после успешного
    // создания задачи тихо обнулял clientTasks, будто терапевт ничего не видит.
    mockApi.getTherapyTasksForClient
      .mockResolvedValueOnce([
        { id: 1, title: 'Старая задача', done: false } as unknown,
      ]) // при openClient
      .mockRejectedValueOnce(new Error('network')); // при onCreated
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('open-501')).toBeTruthy());
    fireEvent.click(screen.getByText('open-501'));
    await waitFor(() => expect(screen.getByText('Задач: 1')).toBeTruthy());
    fireEvent.click(screen.getByText('open-assign'));
    fireEvent.click(screen.getByText('create-task'));
    await waitFor(() =>
      expect(screen.queryByTestId('task-create-sheet')).toBeNull(),
    );
    expect(screen.getByText('Задач: 1')).toBeTruthy();
  });

  it('close на TaskCreateSheet скрывает лист без вызова api', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('open-501')).toBeTruthy());
    fireEvent.click(screen.getByText('open-501'));
    await waitFor(() => expect(screen.getByText('open-assign')).toBeTruthy());
    fireEvent.click(screen.getByText('open-assign'));
    mockApi.getTherapyTasksForClient.mockClear();
    fireEvent.click(screen.getByText('close-assign'));
    expect(screen.queryByTestId('task-create-sheet')).toBeNull();
    expect(mockApi.getTherapyTasksForClient).not.toHaveBeenCalled();
  });
});

describe('TherapistClientSheet — каскад аппаратной кнопки «Назад»', () => {
  it('закрывает верхний открытый оверлей первым (assign перед списком)', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('open-501')).toBeTruthy());
    fireEvent.click(screen.getByText('open-501'));
    await waitFor(() => expect(screen.getByText('open-assign')).toBeTruthy());
    fireEvent.click(screen.getByText('open-assign'));
    expect(screen.getByTestId('task-create-sheet')).toBeTruthy();

    fireEvent.click(screen.getByText('fire-back'));
    expect(screen.queryByTestId('task-create-sheet')).toBeNull();
    // Всё ещё на экране клиента — back закрыл только оверлей
    expect(screen.getByText('Клиент: Ирина')).toBeTruthy();
  });

  it('без открытых оверлеев back уводит обратно на список клиентов', async () => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('open-501')).toBeTruthy());
    fireEvent.click(screen.getByText('open-501'));
    await waitFor(() => expect(screen.getByText('Клиент: Ирина')).toBeTruthy());

    fireEvent.click(screen.getByText('fire-back'));
    await waitFor(() => expect(screen.getByTestId('list-view')).toBeTruthy());
  });
});
