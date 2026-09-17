// @vitest-environment jsdom
// Тест хука кабинета терапевта useClientDetail (miniapp-версия, этап 3.3
// TEST_IMPROVEMENT_PLAN — самый большой непокрытый хук miniapp, 488 строк,
// 0 тестов). webapp-двойник (useClientDetail.test.ts +
// useClientDetail.mutations.test.ts) покрыт и служит образцом стиля, но
// miniapp-хук проще: нет debounce-автосейва концептуализации (сохранение —
// явной кнопкой saveConcept), нет onOpenClient/tabLoading/clientTab.
// Этот файл: загрузка данных клиента (в т.ч. гонка между openClient-вызовами
// через openClientIdRef), удаление клиента, заметки терапевта. Мутации
// концептуализации/алиаса/сессий/YSQ/экспорта — в соседнем
// useClientDetail.mutations.test.ts (лимит ~300 строк/файл).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientDetail } from './useClientDetail';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(),
    getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(),
    getClientModeNotes: vi.fn(),
    removeClient: vi.fn(),
    createTherapistNote: vi.fn(),
    deleteTherapistNote: vi.fn(),
    saveConceptualization: vi.fn(),
    renameClient: vi.fn(),
    updateSessionInfo: vi.fn(),
    requestYsq: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeClient = (o: Partial<Record<string, unknown>> = {}) => ({
  telegramId: 1,
  name: 'Иван',
  clientAlias: null,
  streak: 0,
  lastActiveDate: null,
  todayIndex: null,
  recentIndexHistory: [],
  relationCreatedAt: '2026-01-01',
  therapyStartDate: null,
  nextSession: null,
  meetingDays: [],
  schemaIds: [],
  ...o,
});

function setup() {
  const setClients = vi.fn();
  const switchView = vi.fn();
  const { result } = renderHook(() =>
    useClientDetail({ switchView, setClients }),
  );
  return { result, setClients, switchView };
}

/** renderHook + openClient за один вызов — для тестов, которым важно лишь наличие selectedClient. */
async function openedHook(
  clientOverrides: Partial<Record<string, unknown>> = {},
) {
  const ctx = setup();
  await act(async () => {
    await ctx.result.current.openClient(makeClient(clientOverrides));
  });
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue([]);
  mockApi.getConceptualization.mockResolvedValue(null);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── openClient: загрузка ────────────────────────────────────────────────────
describe('openClient', () => {
  it('переключает вид и синхронно кладёт selectedClient, до ответа api', async () => {
    const { result, switchView } = setup();
    let p!: Promise<void>;
    act(() => {
      p = result.current.openClient(makeClient({ telegramId: 42 }));
    });

    expect(switchView).toHaveBeenCalledWith('client');
    expect(result.current.selectedClient?.telegramId).toBe(42);
    // Состояние с прошлой карточки уже сброшено синхронно.
    expect(result.current.clientTasks).toEqual([]);
    expect(result.current.concept).toBeNull();

    await act(async () => {
      await p;
    });
  });

  it('раскладывает ответы api по состояниям после загрузки', async () => {
    mockApi.getTherapyTasksForClient.mockResolvedValue([{ id: 1 }]);
    mockApi.getTherapistNotes.mockResolvedValue([
      { id: 5, date: '2026-01-01' },
    ]);
    mockApi.getConceptualization.mockResolvedValue({
      id: 3,
      schemaIds: ['abandonment'],
      modeIds: [],
    });
    mockApi.getTherapyClientData.mockResolvedValue({
      mySchemaIds: ['mistrust'],
      ysqActiveSchemaIds: ['defectiveness'],
    });
    mockApi.getClientSchemaNotes.mockResolvedValue([
      { schemaId: 'abandonment' },
    ]);
    mockApi.getClientModeNotes.mockResolvedValue([
      { modeId: 'vulnerable_child' },
    ]);

    const { result } = await openedHook();

    expect(result.current.clientTasks).toEqual([{ id: 1 }]);
    expect(result.current.notes).toEqual([{ id: 5, date: '2026-01-01' }]);
    expect(result.current.localConcept).toEqual(result.current.concept);
    expect(result.current.clientSchemaNotesData).toEqual([
      { schemaId: 'abandonment' },
    ]);
    expect(result.current.clientModeNotesData).toEqual([
      { modeId: 'vulnerable_child' },
    ]);
    expect(result.current.selfSchemaIds).toEqual(['mistrust']);
    expect(result.current.ysqSchemaIds).toEqual(['defectiveness']);
    expect(result.current.activeSchemaIds).toEqual(['abandonment']);
  });

  it('при отказе части запросов подставляет фолбэк ([]/null), не роняя остальные', async () => {
    mockApi.getTherapistNotes.mockRejectedValue(new Error('boom'));
    mockApi.getConceptualization.mockRejectedValue(new Error('boom'));
    mockApi.getTherapyClientData.mockResolvedValue({ mySchemaIds: ['x'] });

    const { result } = await openedHook();
    expect(result.current.notes).toEqual([]);
    expect(result.current.concept).toBeNull();
    expect(result.current.selfSchemaIds).toEqual(['x']);
  });

  // Регрессия: раньше `.catch(() => [])`/`.catch(() => null)` на каждый из
  // шести запросов терял факт сбоя — терапевт видел пустой список заметок и
  // не мог отличить «у клиента правда ничего нет» от «сеть подвела». Теперь
  // fetchClientDetail помечает это явным флагом.
  it('при отказе хотя бы одного запроса выставляет clientLoadError=true', async () => {
    mockApi.getTherapistNotes.mockRejectedValue(new Error('boom'));
    const { result } = await openedHook();
    expect(result.current.clientLoadError).toBe(true);
  });

  it('когда все запросы успешны — clientLoadError=false', async () => {
    const { result } = await openedHook();
    expect(result.current.clientLoadError).toBe(false);
  });

  it('открытие следующего клиента без ошибок сбрасывает clientLoadError в false', async () => {
    mockApi.getTherapistNotes.mockRejectedValueOnce(new Error('boom'));
    const { result } = setup();
    await act(async () => {
      await result.current.openClient(makeClient({ telegramId: 1 }));
    });
    expect(result.current.clientLoadError).toBe(true);

    await act(async () => {
      await result.current.openClient(makeClient({ telegramId: 2 }));
    });
    expect(result.current.clientLoadError).toBe(false);
  });

  it('игнорирует устаревший ответ, если за это время открыли другого клиента (защита от гонки)', async () => {
    let resolveFirst!: (v: unknown[]) => void;
    const pending = new Promise<unknown[]>((res) => {
      resolveFirst = res;
    });
    mockApi.getTherapyTasksForClient.mockReturnValueOnce(pending);

    const { result } = setup();
    let firstOpen!: Promise<void>;
    act(() => {
      firstOpen = result.current.openClient(makeClient({ telegramId: 1 }));
    });

    mockApi.getTherapyTasksForClient.mockResolvedValue([{ id: 99 }]);
    await act(async () => {
      await result.current.openClient(makeClient({ telegramId: 2 }));
    });
    expect(result.current.clientTasks).toEqual([{ id: 99 }]);

    await act(async () => {
      resolveFirst([{ id: 1, stale: true }]);
      await firstOpen;
    });
    expect(result.current.selectedClient?.telegramId).toBe(2);
    expect(result.current.clientTasks).toEqual([{ id: 99 }]); // не затёрто устаревшим ответом
  });

  it('подставляет даты/дни сессий клиента в локальные поля редактирования', async () => {
    const { result } = await openedHook({
      therapyStartDate: '2026-01-10',
      nextSession: '2026-02-01',
      meetingDays: [1, 3],
    });
    expect(result.current.localStartDate).toBe('2026-01-10');
    expect(result.current.localNextSession).toBe('2026-02-01');
    expect(result.current.localMeetingDays).toEqual([1, 3]);
  });

  it('открытие нового клиента закрывает все листы, открытые для предыдущего', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.openClient(makeClient({ telegramId: 1 }));
    });
    act(() => {
      result.current.setShowTasksSheet(true);
      result.current.setShowNotesSheet(true);
    });
    expect(result.current.showTasksSheet).toBe(true);

    await act(async () => {
      await result.current.openClient(makeClient({ telegramId: 2 }));
    });
    expect(result.current.showTasksSheet).toBe(false);
    expect(result.current.showNotesSheet).toBe(false);
  });
});

// ── Удаление клиента ─────────────────────────────────────────────────────────
describe('deleteClient', () => {
  it('ничего не делает без выбранного клиента', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.deleteClient();
    });
    expect(mockApi.removeClient).not.toHaveBeenCalled();
  });

  it('ничего не делает, если пользователь отменил confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = await openedHook();
    await act(async () => {
      await result.current.deleteClient();
    });
    expect(mockApi.removeClient).not.toHaveBeenCalled();
  });

  it('удаляет клиента, чистит список и переключает вид на list', async () => {
    mockApi.removeClient.mockResolvedValue(undefined);
    const { result, setClients, switchView } = await openedHook({
      telegramId: 5,
    });
    await act(async () => {
      await result.current.deleteClient();
    });

    expect(mockApi.removeClient).toHaveBeenCalledWith(5);
    expect(switchView).toHaveBeenCalledWith('list');
    const updater = setClients.mock.calls.at(-1)![0];
    expect(updater([{ telegramId: 5 }, { telegramId: 6 }])).toEqual([
      { telegramId: 6 },
    ]);
  });

  it('при ошибке api выставляет deleteError и не переключает вид', async () => {
    mockApi.removeClient.mockRejectedValue(new Error('fail'));
    const { result, switchView } = await openedHook();
    switchView.mockClear();
    await act(async () => {
      await result.current.deleteClient();
    });
    expect(result.current.deleteError).toBe('Не удалось удалить клиента');
    expect(switchView).not.toHaveBeenCalled();
    expect(result.current.deleteLoading).toBe(false);
  });
});

// ── Заметки терапевта ────────────────────────────────────────────────────────
describe('addNote / removeNote', () => {
  it('не отправляет пустую (или из пробелов) заметку', async () => {
    const { result } = await openedHook();
    act(() => {
      result.current.setNewNoteText('   ');
    });
    await act(async () => {
      await result.current.addNote();
    });
    expect(mockApi.createTherapistNote).not.toHaveBeenCalled();
  });

  it('сохраняет заметку с trim-текстом и сегодняшней датой, ставит в начало списка', async () => {
    const newNote = { id: 10, date: '2026-07-17', text: 'привет' };
    mockApi.createTherapistNote.mockResolvedValue(newNote);
    const { result } = await openedHook();
    act(() => {
      result.current.setNewNoteText('  привет  ');
    });
    await act(async () => {
      await result.current.addNote();
    });

    expect(mockApi.createTherapistNote).toHaveBeenCalledWith(
      1,
      expect.any(String),
      'привет',
    );
    expect(result.current.notes[0]).toEqual(newNote);
    expect(result.current.newNoteText).toBe('');
  });

  it('addNote выставляет noteError при ошибке api, не бросая исключение', async () => {
    mockApi.createTherapistNote.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook();
    act(() => {
      result.current.setNewNoteText('x');
    });
    await act(async () => {
      await result.current.addNote();
    });
    expect(result.current.noteError).toBe('Не удалось сохранить заметку');
    expect(result.current.noteSaving).toBe(false);
  });

  it('removeNote удаляет заметку из списка по id', async () => {
    mockApi.getTherapistNotes.mockResolvedValue([
      { id: 1, date: '2026-01-01' },
      { id: 2, date: '2026-01-02' },
    ]);
    mockApi.deleteTherapistNote.mockResolvedValue(undefined);
    const { result } = await openedHook();
    await act(async () => {
      await result.current.removeNote(1);
    });
    expect(mockApi.deleteTherapistNote).toHaveBeenCalledWith(1);
    expect(result.current.notes.map((n) => n.id)).toEqual([2]);
  });

  it('removeNote выставляет noteError при ошибке api', async () => {
    mockApi.getTherapistNotes.mockResolvedValue([
      { id: 1, date: '2026-01-01' },
    ]);
    mockApi.deleteTherapistNote.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook();
    await act(async () => {
      await result.current.removeNote(1);
    });
    expect(result.current.noteError).toBe('Не удалось удалить заметку');
    // Не отфильтровано, т.к. api упал.
    expect(result.current.notes.map((n) => n.id)).toEqual([1]);
  });
});
