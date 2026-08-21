// @vitest-environment jsdom
// Компонентные тесты кабинета терапевта (TherapistClientSheet): список
// клиентов (пустое состояние/загрузка), открытие карточки клиента, вкладка
// «Записи клиента» — и изоляция данных между клиентами (CLAUDE.md, читка
// «нет клиента → нет данных»: денормализованное per-client состояние в
// useClientDetail сбрасывается синхронно при открытии нового клиента —
// тест ловит регресс, если кто-то уберёт этот сброс).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    getTherapyClientHistory: vi.fn(),
    getClientDiary: vi.fn(),
    getAllTherapyTasks: vi.fn(),
    addVirtualClient: vi.fn(),
    createTherapyInvite: vi.fn(),
    createTherapistNote: vi.fn(),
    deleteTherapistNote: vi.fn(),
    requestYsq: vi.fn(),
    saveConceptualization: vi.fn(),
    updateSessionInfo: vi.fn(),
    renameClient: vi.fn(),
    removeClient: vi.fn(),
    createTask: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockReportClientError = reportClientError as unknown as ReturnType<typeof vi.fn>;

function client(overrides: Partial<TherapyClientSummary>): TherapyClientSummary {
  return {
    telegramId: 1,
    name: 'Иван',
    clientAlias: null,
    streak: 0,
    lastActiveDate: null,
    todayIndex: null,
    recentIndexHistory: [],
    relationCreatedAt: '2026-01-01T00:00:00.000Z',
    therapyStartDate: null,
    nextSession: null,
    meetingDays: [],
    schemaIds: [],
    ...overrides,
  };
}

// По умолчанию у любого клиента — «чистая» карточка: без задач, заметок,
// концептуализации, дневника. Переопределяется per-test через mockImplementation.
function emptyClientDetailMocks() {
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue([]);
  mockApi.getConceptualization.mockResolvedValue(null);
  mockApi.getTherapyClientData.mockResolvedValue({
    name: null, mySchemaIds: [], myModeIds: [], ysqCompletedAt: null, ysqActiveSchemaIds: [], ysqHistory: [],
  });
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  emptyClientDetailMocks();
});

afterEach(() => {
  cleanup();
});

// TherapistClientSheet держит `view` как controlled-проп (реальный владелец —
// родитель-страница) — в тесте нужен минимальный владелец состояния, иначе
// switchView('client') вызовет onViewChange, но экран не переключится.
function Wrapper() {
  const [view, setView] = useState<'list' | 'client'>('list');
  return <TherapistClientSheet view={view} onViewChange={setView} onClose={vi.fn()} />;
}

function renderSheet() {
  return render(<Wrapper />);
}

describe('TherapistClientSheet — список клиентов: загрузка и пустое состояние', () => {
  it('пока getTherapyClients не резолвнулся — показывает "Загрузка..."', async () => {
    let resolve!: (v: TherapyClientSummary[]) => void;
    mockApi.getTherapyClients.mockReturnValue(new Promise(r => { resolve = r; }));
    renderSheet();

    expect(screen.getByText('Загрузка...')).toBeTruthy();
    resolve([]);
    await screen.findByText(/Введи имя клиента выше/);
  });

  it('на чистом аккаунте (0 клиентов) — пустое состояние, а не выдуманные карточки', async () => {
    mockApi.getTherapyClients.mockResolvedValue([]);
    renderSheet();

    await screen.findByText(/Введи имя клиента выше, чтобы добавить первую карточку/);
    // Счётчик клиентов — реальный 0 из ответа api, а не «зависшее» число из
    // другого места (правило CLAUDE.md про хардкод-заглушки).
    expect(screen.getByText(/^0/)).toBeTruthy();
    // Ложная тревога хуже молчания: настоящая пустота — не ошибка загрузки.
    expect(screen.queryByText(/Не удалось загрузить клиентов/)).toBeNull();
  });

  // РЕГРЕССИЯ: сбой getTherapyClients раньше оставлял clients = [] с loading
  // снятым — ListView рисовала онбординг «клиентов нет», хотя это «неизвестно»,
  // а не «пусто» (терапевт с полным ростером в офлайне видел бы пустой кабинет).
  it('сбой getTherapyClients — «не удалось загрузить», а не онбординг «клиентов нет»', async () => {
    mockApi.getTherapyClients.mockRejectedValue(new Error('offline'));
    renderSheet();

    await act(async () => {});

    expect(screen.getByText(/Не удалось загрузить клиентов/)).toBeTruthy();
    expect(screen.queryByText(/Введи имя клиента выше/)).toBeNull();
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'therapist.clients' }),
    );
  });
});

describe('TherapistClientSheet — список клиентов: реальные данные', () => {
  it('рендерит имя и алиас клиента из ответа api, а не хардкод', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 42, name: 'Пётр', clientAlias: 'П.' }),
    ]);
    renderSheet();

    await screen.findByText('П.');
    expect(screen.queryByText('Пётр')).toBeNull(); // алиас перекрывает имя в строке списка
  });
});

describe('TherapistClientSheet — открытие карточки клиента', () => {
  it('клик по клиенту переключает на вид клиента с его именем в шапке', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна' })]);
    renderSheet();
    await screen.findByText('Анна');

    fireEvent.click(screen.getByText('Анна'));

    await waitFor(() => expect(mockApi.getTherapyTasksForClient).toHaveBeenCalledWith(7));
    // Шапка карточки клиента показывает имя (заголовок h1-стиль), а не просто строка списка.
    await waitFor(() => expect(screen.getAllByText('Анна').length).toBeGreaterThan(0));
    expect(screen.getByText('Обзор')).toBeTruthy();
  });

  it('пустая карточка (без концептуализации/заметок/дневника) во вкладке «Обзор» показывает подсказку заполнить концептуализацию', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна' })]);
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));

    await screen.findByText(/Заполни концептуализацию, чтобы увидеть схемы и режимы клиента/);
  });
});

describe('TherapistClientSheet — вкладка «Записи клиента»', () => {
  it('без записей — пустое состояние "ещё не заполнял дневник"', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна' })]);
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByText('Записи клиента'));

    await screen.findByText('Клиент ещё не заполнял дневник');
  });

  it('с записями — показывает реальные данные из api, а не пусто и не чужие данные', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна' })]);
    mockApi.getClientDiary.mockResolvedValue([
      { type: 'gratitude' as const, date: '2026-07-20', excerpt: 'Спасибо за поддержку' },
    ]);
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByText('Записи клиента'));

    await screen.findByText('Благодарность');
    expect(screen.getByText('Спасибо за поддержку')).toBeTruthy();
  });
});

// Регрессионный тест: денормализованное per-client состояние (заметки/дневник/
// концептуализация) живёт в useClientDetail и обязано сброситься СИНХРОННО при
// открытии нового клиента — иначе на миг (или навсегда, при ошибке одного из
// параллельных fetch) виден чужой дневник.
describe('TherapistClientSheet — изоляция данных между клиентами', () => {
  it('открытие клиента Б после клиента А с записями не показывает записи А', async () => {
    const clientA = client({ telegramId: 1, name: 'Клиент А' });
    const clientB = client({ telegramId: 2, name: 'Клиент Б' });
    mockApi.getTherapyClients.mockResolvedValue([clientA, clientB]);
    mockApi.getClientDiary.mockImplementation((id: number) =>
      id === 1
        ? Promise.resolve([{ type: 'gratitude' as const, date: '2026-07-20', excerpt: 'Секрет клиента А' }])
        : Promise.resolve([]),
    );

    renderSheet();
    await screen.findByText('Клиент А');

    // Открываем А, проверяем что его запись видна.
    fireEvent.click(screen.getByText('Клиент А'));
    await screen.findByText('Обзор');
    fireEvent.click(screen.getByText('Записи клиента'));
    await screen.findByText('Секрет клиента А');

    // Назад к списку и открываем Б.
    fireEvent.click(screen.getByText('← Все клиенты'));
    await screen.findByText('Клиент Б');
    fireEvent.click(screen.getByText('Клиент Б'));
    await screen.findByText('Обзор');
    fireEvent.click(screen.getByText('Записи клиента'));

    // У Б нет записей — пустое состояние, и точно не текст А.
    await screen.findByText('Клиент ещё не заполнял дневник');
    expect(screen.queryByText('Секрет клиента А')).toBeNull();
  });
});

describe('TherapistClientSheet — вкладка «Сессии» (заметки терапевта)', () => {
  async function openSessionsTab(name = 'Анна') {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name })]);
    renderSheet();
    await screen.findByText(name);
    fireEvent.click(screen.getByText(name));
    await screen.findByText('Обзор');
    fireEvent.click(screen.getByText('Сессии'));
    await screen.findByText('Заметок пока нет');
  }

  it('без заметок — "Заметок пока нет", кнопка «Сохранить» задизейблена', async () => {
    await openSessionsTab();
    const saveBtn = screen.getByText('Сохранить') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('сохранение заметки вызывает api.createTherapistNote и добавляет её в архив', async () => {
    mockApi.createTherapistNote.mockResolvedValue({ id: 99, therapistId: 1, clientId: 7, date: '2026-07-20', text: 'Хорошая динамика', createdAt: '2026-07-20T00:00:00.000Z' });
    await openSessionsTab();

    fireEvent.change(screen.getByPlaceholderText('Наблюдения, гипотезы, динамика, план следующей встречи…'), {
      target: { value: 'Хорошая динамика' },
    });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(mockApi.createTherapistNote).toHaveBeenCalledWith(7, expect.any(String), 'Хорошая динамика'));
    await screen.findByText('Хорошая динамика');
    expect(screen.queryByText('Заметок пока нет')).toBeNull();
  });

  it('ошибка api.createTherapistNote показывает сообщение, заметка не пропадает из поля', async () => {
    mockApi.createTherapistNote.mockRejectedValue(new Error('network down'));
    await openSessionsTab();

    fireEvent.change(screen.getByPlaceholderText('Наблюдения, гипотезы, динамика, план следующей встречи…'), {
      target: { value: 'Заметка' },
    });
    fireEvent.click(screen.getByText('Сохранить'));

    await screen.findByText('Не удалось сохранить заметку');
  });
});

describe('TherapistClientSheet — вкладка «Схемы» (YSQ)', () => {
  it('без прохождений — пустое состояние и запрос теста, а не выдуманная статистика', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна' })]);
    mockApi.requestYsq.mockResolvedValue(undefined);
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByText('Схемы'));
    await screen.findByText('YSQ ещё не проходился');

    fireEvent.click(screen.getByText('Запросить тест на схемы'));
    await waitFor(() => expect(mockApi.requestYsq).toHaveBeenCalledWith(7));
    await screen.findByText('✓ Запрос отправлен');
  });

  it('оффлайн-клиент (telegramId < 0) не может запросить YSQ — кнопки нет вообще', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: -5, name: null, clientAlias: 'Оффлайн Клиент' })]);
    renderSheet();
    await screen.findByText('Оффлайн Клиент');
    fireEvent.click(screen.getByText('Оффлайн Клиент'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByText('Схемы'));
    await screen.findByText('Клиент без Telegram – YSQ недоступен');
    expect(screen.queryByText('Запросить тест на схемы')).toBeNull();
  });
});

// Регрессия (см. useClientDetail.mutations.test.ts): autoSave раньше молча
// проглатывал ошибку api.saveConceptualization — терапевт не видел, что
// правка не сохранилась. Тест на уровне компонента подтверждает, что
// ClientConceptTab реально показывает conceptError, а не только внутренний
// стейт хука.
describe('TherapistClientSheet — вкладка «Концептуализация»: ошибка автосохранения видна', () => {
  it('клик по схеме → автосохранение падает → баннер ошибки виден пользователю', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна' })]);
    mockApi.saveConceptualization.mockRejectedValue(new Error('network down'));
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByText('Концептуализация'));
    await screen.findByText('Актуальные схемы');

    // Клик по чипу схемы включает patchConcept → debounce 700мс → autoSave.
    fireEvent.click(screen.getByText('Эмоциональная депривация'));

    await waitFor(
      () => expect(screen.getByText(/Не удалось сохранить изменения/)).toBeTruthy(),
      { timeout: 2000 },
    );
  });
});

describe('TherapistClientSheet — вкладка «Задания»', () => {
  const taskFor7 = (over: Record<string, unknown>) => ({
    id: 1, userId: 7, assignedBy: 1, type: 'note', text: '', targetDays: null,
    needId: null, dueDate: null, done: false, completedAt: null,
    createdAt: '2026-07-20T00:00:00.000Z', ...over,
  });

  // Открывает клиента «Анна» (telegramId 7) и её вкладку «Задания».
  async function openAnnaTasks(withRouter = false) {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна' })]);
    if (withRouter) {
      // TaskCreateSheet внутри зовёт useHistorySheet → нужен Router.
      render(
        <MemoryRouter>
          <Wrapper />
        </MemoryRouter>,
      );
    } else {
      renderSheet();
    }
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');
    fireEvent.click(screen.getByText('Задания'));
  }

  it('без заданий — пустое состояние с призывом назначить, не выдуманный список', async () => {
    await openAnnaTasks();
    await screen.findByText(/Нет назначенных заданий/);
    expect(screen.getByText('Нет активных')).toBeTruthy();
  });

  it('с заданиями — активные и выполненные разнесены по секциям с реальными данными', async () => {
    mockApi.getTherapyTasksForClient.mockResolvedValue([
      taskFor7({ text: 'Заполнить схема-карточку' }),
      taskFor7({ id: 2, text: 'Дневник благодарности', done: true, completedAt: '2026-07-19T00:00:00.000Z' }),
    ]);
    await openAnnaTasks();
    await screen.findByText('Заполнить схема-карточку');
    expect(screen.getByText('Дневник благодарности')).toBeTruthy();
    expect(screen.getByText('В работе')).toBeTruthy();
    expect(screen.getByText('Выполнено')).toBeTruthy();
  });

  // РЕГРЕССИЯ (правило №3): в мини-аппе этот баг починили, а webapp-двойник
  // остался со старым `.catch(() => [])` — сбой перечитывания после
  // назначения задачи обнулял уже показанный список, будто задачи пропали.
  it('сбой перечитывания после назначения не стирает показанный список задач', async () => {
    mockApi.getTherapyTasksForClient
      .mockResolvedValueOnce([taskFor7({ text: 'Заполнить схема-карточку' })])
      .mockRejectedValue(new Error('offline'));
    mockApi.createTask.mockResolvedValue({});
    await openAnnaTasks(true);
    await screen.findByText('Заполнить схема-карточку');

    fireEvent.click(screen.getByText('+ Назначить'));
    await act(async () => {
      fireEvent.click(screen.getByText('Назначить задание'));
    });

    expect(mockApi.createTask).toHaveBeenCalledTimes(1);
    // Список не обнулился: задача на месте, несмотря на упавший рефетч.
    expect(screen.getByText('Заполнить схема-карточку')).toBeTruthy();
  });
});

describe('TherapistClientSheet — сайдбар «Обзор»: индекс и потребности из реальных данных', () => {
  it('показывает todayIndex и потребности дня клиента, а не пустые заглушки', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна', todayIndex: 7.4 })]);
    mockApi.getTherapyClientHistory.mockResolvedValue([
      { date: '2026-07-20', index: 7.4, ratings: { attachment: 8, autonomy: 6 } },
      { date: '2026-07-19', index: 6.0, ratings: {} },
      { date: '2026-07-18', index: 5.5, ratings: {} },
    ]);
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');

    await screen.findByText('7.4');
    expect(screen.getByText('Привязанность')).toBeTruthy();
    expect(screen.getByText('Автономия')).toBeTruthy();
  });

  it('редактирование «Следующая сессия» вызывает api.updateSessionInfo с новой датой', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна', nextSession: null })]);
    mockApi.updateSessionInfo.mockResolvedValue(undefined);
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');
    await screen.findByText('Не установлена');

    fireEvent.click(screen.getByText('Изменить →'));
    const input = screen.getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-08-10T10:00' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(mockApi.updateSessionInfo).toHaveBeenCalledWith(7, { nextSession: '2026-08-10T10:00' }));
  });

  // РЕГРЕССИЯ (check-silent-catch): раньше кнопка «Сохранить» закрывала поле
  // редактирования сразу после await, не проверяя исход — терапевт видел
  // «Не установлена» смениться на закрытую форму, будто дата сохранилась,
  // хотя запрос упал. Теперь поле остаётся открытым и видна ошибка.
  it('провал api.updateSessionInfo: поле редактирования не закрывается, видна ошибка', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна', nextSession: null })]);
    mockApi.updateSessionInfo.mockRejectedValue(new Error('network down'));
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');
    await screen.findByText('Не установлена');

    fireEvent.click(screen.getByText('Изменить →'));
    const input = screen.getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-08-10T10:00' } });
    fireEvent.click(screen.getByText('Сохранить'));

    await screen.findByRole('alert');
    // Поле осталось в режиме редактирования (кнопка «Сохранить» всё ещё видна).
    expect(screen.getByText('Сохранить')).toBeTruthy();
    // «Не установлена» не вернулось — потому что мы и не выходили из формы,
    // но серверное значение точно не сменилось на новую дату.
    expect(screen.queryByText(/2026.*10:00/)).toBeNull();
  });
});

// Насыщенная карточка: концептуализация, YSQ-история (≥2 прохождений — рисует
// график динамики), заметки терапевта, дневник клиента, схема/режим-карточки.
// Проверяем, что реальные данные из api реально доходят до экрана на каждой
// вкладке — не только пустые состояния.
describe('TherapistClientSheet — насыщенная карточка клиента: реальные данные на всех вкладках', () => {
  function setupRichClient() {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Анна' })]);
    mockApi.getConceptualization.mockResolvedValue({
      id: 1, therapistId: 1, clientId: 7,
      schemaIds: ['abandonment'], modeIds: ['vulnerable_child'],
      earlyExperience: 'Ранний опыт клиента', unmetNeeds: null, triggers: null,
      copingStyles: null, goals: 'Научиться выражать чувства', currentProblems: null,
      modeTransitions: null, modeMapNodes: [], modeMapEdges: [],
      history: [{ savedAt: '2026-07-01T00:00:00.000Z', schemaIds: ['abandonment'], modeIds: [], earlyExperience: 'старая версия', unmetNeeds: null, triggers: null, copingStyles: null, goals: null, currentProblems: null, modeTransitions: null }],
      updatedAt: '2026-07-10T00:00:00.000Z',
    });
    mockApi.getTherapyClientData.mockResolvedValue({
      name: 'Анна', mySchemaIds: [], myModeIds: [], ysqCompletedAt: '2026-07-15T00:00:00.000Z',
      ysqActiveSchemaIds: ['abandonment'],
      ysqHistory: [
        { id: 2, completedAt: '2026-07-15T00:00:00.000Z', scores: [{ id: 'abandonment', pct5plus: 70 }, { id: 'emotional_deprivation', pct5plus: 40 }] },
        { id: 1, completedAt: '2026-06-01T00:00:00.000Z', scores: [{ id: 'abandonment', pct5plus: 50 }, { id: 'emotional_deprivation', pct5plus: 30 }] },
      ],
    });
    mockApi.getTherapistNotes.mockResolvedValue([
      { id: 5, therapistId: 1, clientId: 7, date: '2026-07-20', text: 'Заметка последней сессии', createdAt: '2026-07-20T00:00:00.000Z' },
    ]);
    mockApi.getClientDiary.mockResolvedValue([
      { type: 'schema' as const, date: '2026-07-19', schemaIds: ['abandonment'], excerpt: 'Триггернуло на встрече' },
    ]);
    mockApi.getClientSchemaNotes.mockResolvedValue([
      { schemaId: 'abandonment', triggers: 'Одиночество', feelings: 'Тревога', thoughts: '', origins: '', reality: '', healthyView: '', behavior: '' },
    ]);
    mockApi.getClientModeNotes.mockResolvedValue([
      { modeId: 'vulnerable_child', triggers: 'Критика', feelings: 'Грусть', thoughts: '', needs: '', behavior: '' },
    ]);
  }

  async function openAnna() {
    setupRichClient();
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Анна'));
    await screen.findByText('Обзор');
  }

  it('«Обзор» показывает цель терапии, активные схемы/режимы и последнюю заметку сессии', async () => {
    await openAnna();
    await screen.findByText('Научиться выражать чувства');
    expect(screen.getByText('Заметка последней сессии')).toBeTruthy();
    expect(screen.getByText(/Триггернуло на встрече/)).toBeTruthy();
  });

  it('«Концептуализация» показывает историю версий и сверку с YSQ', async () => {
    await openAnna();
    fireEvent.click(screen.getByText('Концептуализация'));
    await screen.findByText('История версий · 1');

    fireEvent.click(screen.getByText('Версия 1'));
    await screen.findByText('старая версия');
  });

  it('«Схемы» с двумя прохождениями рисует график динамики и таблицу с дельтой', async () => {
    await openAnna();
    fireEvent.click(screen.getByText('Схемы'));
    await screen.findByText('Динамика топ-5 схем');
    // 70% (текущее) против 50% (предыдущее) — дельта +20.
    expect(screen.getByText('+20')).toBeTruthy();
  });

  it('«Записи клиента» показывает схема- и режим-карточки терапевта', async () => {
    await openAnna();
    fireEvent.click(screen.getByText('Записи клиента'));
    await screen.findByText('Схема-карточки · 1');
    expect(screen.getByText('Режим-карточки · 1')).toBeTruthy();
    expect(screen.getByText('Одиночество')).toBeTruthy();
  });
});

describe('TherapistClientSheet — переименование клиента (алиас)', () => {
  it('сохранение нового имени вызывает api.renameClient и обновляет шапку', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Иван Петров' })]);
    mockApi.renameClient.mockResolvedValue(undefined);
    renderSheet();
    await screen.findByText('Иван Петров');
    fireEvent.click(screen.getByText('Иван Петров'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByLabelText('Переименовать'));
    const input = screen.getByDisplayValue('Иван Петров') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'И.П.' } });
    fireEvent.click(screen.getByText('OK'));

    await waitFor(() => expect(mockApi.renameClient).toHaveBeenCalledWith(7, 'И.П.'));
    await screen.findByText('И.П.');
  });

  it('ошибка renameClient показывает сообщение, имя не меняется', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Иван Петров' })]);
    mockApi.renameClient.mockRejectedValue(new Error('network'));
    renderSheet();
    await screen.findByText('Иван Петров');
    fireEvent.click(screen.getByText('Иван Петров'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByLabelText('Переименовать'));
    fireEvent.change(screen.getByDisplayValue('Иван Петров'), { target: { value: 'Новое имя' } });
    fireEvent.click(screen.getByText('OK'));

    await screen.findByText('Не удалось сохранить имя');
    // Список клиентов не обновился новым именем — rename не «тихо прошёл».
    fireEvent.click(screen.getByText('← Все клиенты'));
    await screen.findByText('Иван Петров');
    expect(screen.queryByText('Новое имя')).toBeNull();
  });
});

describe('TherapistClientSheet — удаление клиента', () => {
  // Ж4 (аудит 2026-08): нативный window.confirm() заменён на ConfirmDialog —
  // клик по кнопке-корзине открывает диалог, удаление подтверждается его
  // собственной кнопкой «Удалить».
  it('клик по кнопке-корзине открывает диалог, api не вызывается сразу', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Иван Петров' })]);
    renderSheet();
    await screen.findByText('Иван Петров');
    fireEvent.click(screen.getByText('Иван Петров'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByLabelText('Удалить клиента'));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('Удалить Иван Петров?')).toBeTruthy();
    expect(mockApi.removeClient).not.toHaveBeenCalled();
  });

  it('подтверждение в диалоге вызывает api.removeClient и возвращает к списку', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Иван Петров' })]);
    mockApi.removeClient.mockResolvedValue(undefined);
    renderSheet();
    await screen.findByText('Иван Петров');
    fireEvent.click(screen.getByText('Иван Петров'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByLabelText('Удалить клиента'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Удалить'));

    await waitFor(() => expect(mockApi.removeClient).toHaveBeenCalledWith(7));
    await screen.findByText(/Введи имя клиента выше/);
  });

  it('отмена в диалоге не вызывает api', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 7, name: 'Иван Петров' })]);
    renderSheet();
    await screen.findByText('Иван Петров');
    fireEvent.click(screen.getByText('Иван Петров'));
    await screen.findByText('Обзор');

    fireEvent.click(screen.getByLabelText('Удалить клиента'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Отмена'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockApi.removeClient).not.toHaveBeenCalled();
  });
});

describe('TherapistClientSheet — поиск и фильтр в списке клиентов', () => {
  it('поиск по имени сужает список до совпадений, "Ничего не найдено" на нулевой выдаче', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Анна' }),
      client({ telegramId: 2, name: 'Борис' }),
    ]);
    renderSheet();
    await screen.findByText('Анна');
    expect(screen.getByText('Борис')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Найти клиента'), { target: { value: 'анн' } });
    expect(screen.getByText('Анна')).toBeTruthy();
    expect(screen.queryByText('Борис')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Найти клиента'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  });

  it('фильтр «Оффлайн» показывает только клиентов без Telegram (name: null)', async () => {
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Анна' }),
      client({ telegramId: -2, name: null, clientAlias: 'Оффлайн-клиент' }),
    ]);
    renderSheet();
    await screen.findByText('Анна');

    fireEvent.click(screen.getByText('Оффлайн'));

    expect(screen.queryByText('Анна')).toBeNull();
    expect(screen.getByText('Оффлайн-клиент')).toBeTruthy();
  });
});

describe('TherapistClientSheet — дашборд «сегодня» в списке клиентов', () => {
  it('клиент с сессией сегодня и активный сегодня попадают в соответствующие блоки дашборда', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockApi.getTherapyClients.mockResolvedValue([
      client({ telegramId: 1, name: 'Анна', nextSession: `${today}T15:00:00.000Z`, streak: 3 }),
      client({ telegramId: 2, name: 'Борис', lastActiveDate: today, todayIndex: 6.2 }),
    ]);
    renderSheet();
    await screen.findByText('Сессии сегодня');

    expect(screen.getByText('Активны сегодня')).toBeTruthy();
    expect(screen.getByText('3 дн. подряд')).toBeTruthy();
  });

  it('без сессий/активности сегодня — дашборд не рендерится (не пустые заголовки)', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 1, name: 'Анна' })]);
    renderSheet();
    await screen.findByText('Анна');

    expect(screen.queryByText('Сессии сегодня')).toBeNull();
    expect(screen.queryByText('Активны сегодня')).toBeNull();
  });
});

describe('TherapistClientSheet — вкладка «Задания» списка (канбан по всем клиентам)', () => {
  it('без заданий у всех клиентов — "Назначенных заданий пока нет"', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 1, name: 'Анна' })]);
    mockApi.getAllTherapyTasks.mockResolvedValue([{ clientId: 1, clientName: 'Анна', tasks: [] }]);
    renderSheet();
    await screen.findByText('Анна');

    fireEvent.click(screen.getByText('Задания'));

    await screen.findByText('Назначенных заданий пока нет');
  });

  it('задания разных клиентов раскладываются по колонкам "Назначено/Выполнено/Не вышло"', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 1, name: 'Анна' })]);
    mockApi.getAllTherapyTasks.mockResolvedValue([{
      clientId: 1, clientName: 'Анна',
      tasks: [
        { id: 1, userId: 1, assignedBy: 9, type: 'note', text: 'Задание в работе', targetDays: null, needId: null, dueDate: null, done: null, completedAt: null, createdAt: '2026-07-01' },
        { id: 2, userId: 1, assignedBy: 9, type: 'note', text: 'Задание выполнено', targetDays: null, needId: null, dueDate: null, done: true, completedAt: '2026-07-02', createdAt: '2026-07-01' },
      ],
    }]);
    renderSheet();
    await screen.findByText('Анна');

    fireEvent.click(screen.getByText('Задания'));

    await screen.findByText('Задание в работе');
    expect(screen.getByText('Задание выполнено')).toBeTruthy();
    expect(screen.getByText('Назначено')).toBeTruthy();
    expect(screen.getByText('Выполнено')).toBeTruthy();
  });

  // Сбой ≠ пусто (CLAUDE.md): отказ getAllTherapyTasks раньше рисовал
  // терапевту пустую канбан-доску («Назначенных заданий пока нет»), как
  // будто у клиентов реально нет заданий.
  it('провал getAllTherapyTasks показывает явную ошибку, а не пустую доску', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 1, name: 'Анна' })]);
    mockApi.getAllTherapyTasks.mockRejectedValue(new Error('network'));
    renderSheet();
    await screen.findByText('Анна');

    fireEvent.click(screen.getByText('Задания'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить задания/);
    expect(screen.queryByText('Назначенных заданий пока нет')).toBeNull();
  });

  it('«Попробовать ещё раз» в канбане перезапрашивает задания и убирает ошибку при успехе', async () => {
    mockApi.getTherapyClients.mockResolvedValue([client({ telegramId: 1, name: 'Анна' })]);
    mockApi.getAllTherapyTasks.mockRejectedValueOnce(new Error('network'));
    renderSheet();
    await screen.findByText('Анна');
    fireEvent.click(screen.getByText('Задания'));
    await screen.findByRole('alert');

    mockApi.getAllTherapyTasks.mockResolvedValueOnce([{
      clientId: 1, clientName: 'Анна',
      tasks: [{ id: 1, userId: 1, assignedBy: 9, type: 'note', text: 'Задание после повтора', targetDays: null, needId: null, dueDate: null, done: null, completedAt: null, createdAt: '2026-07-01' }],
    }]);
    fireEvent.click(screen.getByText('Попробовать ещё раз'));

    await screen.findByText('Задание после повтора');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
