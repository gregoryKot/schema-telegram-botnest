// @vitest-environment jsdom
// Тест хука кабинета терапевта useClientDetail (аудит: самый большой
// непокрытый хук webapp — 328 строк). Этот файл: загрузка данных клиента
// (в т.ч. гонка между openClient-вызовами через openClientIdRef), удаление
// клиента, заметки терапевта. Мутации концептуализации/алиаса/сессий/YSQ/
// экспорта — в соседнем useClientDetail.mutations.test.ts (лимит ~300 строк/файл).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientDetail } from './useClientDetail';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(), getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(), getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(), getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(), getClientDiary: vi.fn(),
    removeClient: vi.fn(), createTherapistNote: vi.fn(), deleteTherapistNote: vi.fn(),
    saveConceptualization: vi.fn(), renameClient: vi.fn(),
    updateSessionInfo: vi.fn(), requestYsq: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeClient = (o: Partial<Record<string, unknown>> = {}) => ({
  telegramId: 1, name: 'Иван', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [], ...o,
});

function setup() {
  const setClients = vi.fn();
  const switchView = vi.fn();
  const onOpenClient = vi.fn();
  const { result } = renderHook(() => useClientDetail({ onOpenClient, switchView, setClients }));
  return { result, setClients, switchView, onOpenClient };
}

/** renderHook + openClient за один вызов — для тестов мутаций, которым важно лишь наличие selectedClient. */
async function openedHook(clientOverrides: Partial<Record<string, unknown>> = {}) {
  const ctx = setup();
  await act(async () => { await ctx.result.current.openClient(makeClient(clientOverrides)); });
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
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── openClient: загрузка ────────────────────────────────────────────────────
describe('openClient', () => {
  it('переключает вид и сбрасывает состояние синхронно, до ответа api', async () => {
    const { result, switchView, onOpenClient } = setup();
    let p!: Promise<void>;
    act(() => { p = result.current.openClient(makeClient()); });

    expect(switchView).toHaveBeenCalledWith('client');
    expect(onOpenClient).toHaveBeenCalledWith(1);
    expect(result.current.tabLoading).toBe(true);
    expect(result.current.clientTab).toBe('overview');

    await act(async () => { await p; });
    expect(result.current.tabLoading).toBe(false);
  });
  it('раскладывает ответы api по состояниям после загрузки', async () => {
    mockApi.getTherapyTasksForClient.mockResolvedValue([{ id: 1 }]);
    mockApi.getConceptualization.mockResolvedValue({ id: 3, schemaIds: ['abandonment'], modeIds: [] });
    mockApi.getTherapyClientData.mockResolvedValue({ mySchemaIds: ['mistrust'], ysqActiveSchemaIds: ['defectiveness'] });

    const { result } = await openedHook();
    expect(result.current.clientTasks).toEqual([{ id: 1 }]);
    expect(result.current.localConcept).toEqual(result.current.concept);
    expect(result.current.selfSchemaIds).toEqual(['mistrust']);
    expect(result.current.ysqSchemaIds).toEqual(['defectiveness']);
    expect(result.current.activeSchemaIds).toEqual(['abandonment']);
  });
  it('при отказе одного запроса подставляет фолбэк, не роняя остальные', async () => {
    mockApi.getTherapistNotes.mockRejectedValue(new Error('boom'));
    const { result } = await openedHook();
    expect(result.current.notes).toEqual([]);
    expect(result.current.tabLoading).toBe(false);
  });
  it('игнорирует устаревший ответ, если за это время открыли другого клиента (защита от гонки)', async () => {
    let resolveFirst!: (v: unknown[]) => void;
    mockApi.getTherapyTasksForClient.mockImplementationOnce(() => new Promise(res => { resolveFirst = res; }));

    const { result } = setup();
    let firstOpen!: Promise<void>;
    act(() => { firstOpen = result.current.openClient(makeClient({ telegramId: 1 })); });

    mockApi.getTherapyTasksForClient.mockResolvedValue([{ id: 99 }]);
    await act(async () => { await result.current.openClient(makeClient({ telegramId: 2 })); });
    expect(result.current.clientTasks).toEqual([{ id: 99 }]);

    await act(async () => { resolveFirst([{ id: 1, stale: true }]); await firstOpen; });
    expect(result.current.selectedClient?.telegramId).toBe(2);
    expect(result.current.clientTasks).toEqual([{ id: 99 }]); // не затёрто устаревшим ответом
  });
  it('подставляет даты сессии клиента в локальные поля редактирования', async () => {
    const { result } = await openedHook({ therapyStartDate: '2026-01-10', nextSession: '2026-02-01' });
    expect(result.current.localStartDate).toBe('2026-01-10');
    expect(result.current.localNextSession).toBe('2026-02-01');
  });
});

// ── Удаление клиента ─────────────────────────────────────────────────────────
describe('deleteClient', () => {
  it('ничего не делает без выбранного клиента', async () => {
    const { result } = setup();
    await act(async () => { await result.current.deleteClient(); });
    expect(mockApi.removeClient).not.toHaveBeenCalled();
  });
  it('ничего не делает, если пользователь отменил confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = await openedHook();
    await act(async () => { await result.current.deleteClient(); });
    expect(mockApi.removeClient).not.toHaveBeenCalled();
  });
  it('удаляет клиента, чистит список и переключает вид на list', async () => {
    mockApi.removeClient.mockResolvedValue(undefined);
    const { result, setClients, switchView } = await openedHook({ telegramId: 5 });
    await act(async () => { await result.current.deleteClient(); });

    expect(mockApi.removeClient).toHaveBeenCalledWith(5);
    expect(switchView).toHaveBeenCalledWith('list');
    const updater = setClients.mock.calls.at(-1)![0];
    expect(updater([{ telegramId: 5 }, { telegramId: 6 }])).toEqual([{ telegramId: 6 }]);
  });
  it('при ошибке api выставляет deleteError и не переключает вид', async () => {
    mockApi.removeClient.mockRejectedValue(new Error('fail'));
    const { result, switchView } = await openedHook();
    switchView.mockClear();
    await act(async () => { await result.current.deleteClient(); });
    expect(result.current.deleteError).toBe('Не удалось удалить клиента');
    expect(switchView).not.toHaveBeenCalled();
    expect(result.current.deleteLoading).toBe(false);
  });
});

// ── Заметки терапевта ────────────────────────────────────────────────────────
describe('addNote / removeNote', () => {
  it('не отправляет пустую заметку', async () => {
    const { result } = await openedHook();
    await act(async () => { await result.current.addNote(); });
    expect(mockApi.createTherapistNote).not.toHaveBeenCalled();
  });
  it('сохраняет заметку с trim-текстом и сегодняшней датой по умолчанию, ставит в начало списка', async () => {
    const newNote = { id: 10, date: '2026-07-17', text: 'привет' };
    mockApi.createTherapistNote.mockResolvedValue(newNote);
    const { result } = await openedHook();
    act(() => { result.current.setNewNoteText('  привет  '); });
    await act(async () => { await result.current.addNote(); });

    expect(mockApi.createTherapistNote).toHaveBeenCalledWith(1, expect.any(String), 'привет');
    expect(result.current.notes[0]).toEqual(newNote);
    expect(result.current.newNoteText).toBe('');
  });
  it('использует явно выбранную дату заметки, если задана', async () => {
    mockApi.createTherapistNote.mockResolvedValue({ id: 1, date: '2026-05-05', text: 'x' });
    const { result } = await openedHook();
    act(() => { result.current.setNewNoteText('x'); result.current.setNewNoteDate('2026-05-05'); });
    await act(async () => { await result.current.addNote(); });
    expect(mockApi.createTherapistNote).toHaveBeenCalledWith(1, '2026-05-05', 'x');
  });
  it('addNote/removeNote выставляют noteError при ошибке api', async () => {
    mockApi.createTherapistNote.mockRejectedValue(new Error('fail'));
    mockApi.deleteTherapistNote.mockRejectedValue(new Error('fail'));
    const { result } = await openedHook();
    act(() => { result.current.setNewNoteText('x'); });
    await act(async () => { await result.current.addNote(); });
    expect(result.current.noteError).toBe('Не удалось сохранить заметку');

    await act(async () => { await result.current.removeNote(1); });
    expect(result.current.noteError).toBe('Не удалось удалить заметку');
  });
  it('removeNote удаляет заметку из списка по id', async () => {
    mockApi.getTherapistNotes.mockResolvedValue([{ id: 1, date: '2026-01-01' }, { id: 2, date: '2026-01-02' }]);
    mockApi.deleteTherapistNote.mockResolvedValue(undefined);
    const { result } = await openedHook();
    await act(async () => { await result.current.removeNote(1); });
    expect(mockApi.deleteTherapistNote).toHaveBeenCalledWith(1);
    expect(result.current.notes.map(n => n.id)).toEqual([2]);
  });
});
