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
import { todayCalendarDate } from '../../../shared/src/utils/calendarDate';

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
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockReportClientError = reportClientError as unknown as ReturnType<
  typeof vi.fn
>;

vi.mock('./therapistClientSheet/ClientListView', () => ({
  ClientListView: ({
    clients,
    loading,
    loadFailed,
    onClose,
    detail,
    today,
  }: any) => (
    <div data-testid="list-view">
      <span>
        {loading
          ? 'Загрузка'
          : loadFailed
            ? 'сбой-загрузки'
            : `Клиентов: ${clients.length}`}
      </span>
      {/* Тот же расчёт, что StatCards — проверяет проводку today в контейнере,
          не переизобретает компонент (см. TherapistClientSheet — «сегодня»
          ниже). */}
      {!loading && (
        <span>
          АКТИВНЫХ:{' '}
          {clients.filter((c: TherapyClientSummary) => c.lastActiveDate === today).length}
        </span>
      )}
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

  // Регрессия: раньше отказ оставлял clients = [] — «Клиентов: 0», то есть
  // терапевт с полным ростером в офлайне видел «клиентов нет». Сбой ≠ пусто.
  it('ошибка api.getTherapyClients — состояние «сбой», не «клиентов 0», отчёт ушёл', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.getTherapyClients.mockRejectedValue(new Error('network'));
    render(<Harness />);
    await waitFor(() => expect(screen.getByText('сбой-загрузки')).toBeTruthy());
    expect(screen.queryByText('Клиентов: 0')).toBeNull();
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'therapist.clients' }),
    );
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

// Регрессия инцидента 2026-09-17: `today` считался локальной зоной машины
// (todayStr()), а `lastActiveDate` приходит от сервера календарным днём в
// UTC — терапевт с UTC+10 после полудня видел «активных» ноль. Моменты
// зафиксированы там, где локальная дата машины заведомо расходится с UTC,
// поэтому тест краснеет в любой час прогона, а не только когда TZ раннера
// разошёлся с UTC. TZ ставится вручную вокруг всего await-блока (а не через
// forEachTimeZone) — зона обязана оставаться выставленной, пока идёт
// асинхронная догрузка списка клиентов и повторный рендер после неё;
// forEachTimeZone сбрасывает её сразу после синхронного вызова fn, не
// дожидаясь промиса.
describe('TherapistClientSheet — «сегодня» у today считается календарным днём сервера', () => {
  const ZONES = [
    'UTC',
    'Asia/Jerusalem',
    'Australia/Sydney',
    'America/Los_Angeles',
  ];

  afterEach(() => {
    vi.useRealTimers();
  });

  it('клиент с lastActiveDate = todayCalendarDate() — «АКТИВНЫХ: 1» в любой зоне', async () => {
    for (const at of ['2026-09-18T23:30:00Z', '2026-09-19T00:30:00Z']) {
      for (const tz of ZONES) {
        const prevTz = process.env.TZ;
        process.env.TZ = tz;
        try {
          vi.useFakeTimers({ toFake: ['Date'] });
          vi.setSystemTime(new Date(at));
          mockApi.getTherapyClients.mockResolvedValue([
            { ...client, lastActiveDate: todayCalendarDate() },
          ]);
          const { unmount } = render(<Harness />);
          await waitFor(() =>
            expect(screen.getByText('АКТИВНЫХ: 1'), `${at} / ${tz}`).toBeTruthy(),
          );
          unmount();
        } finally {
          vi.useRealTimers();
          if (prevTz === undefined) delete process.env.TZ;
          else process.env.TZ = prevTz;
        }
      }
    }
  });
});
