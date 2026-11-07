// @vitest-environment jsdom
// РЕГРЕССИЯ — инцидент 2026-10-26 (docs/INCIDENTS.md, класс «состояние одного
// клиента протекает в другого при смене клиента»), воспроизведён QA-проходом
// агентом на локальном стенде:
// 1) правка «Целей» у Альфы и клик на Бету в сайдбаре быстрее 700 мс —
//    автосохранение уходило с id Альфы, но с концептуализацией Беты (или
//    пустой, пока Бета грузится): у Альфы на сервере оказывалось чужое/пустое;
// 2) черновик «Новой заметки» (текст и дата) переезжал к следующему клиенту,
//    и «Сохранить» писал заметку ему;
// 3) перезагрузка или закрытие вкладки в течение 700 мс после ввода теряли
//    текст (на сервере `goals: null`).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientDetail } from './useClientDetail';
import { dirtyEverySetter, visibleState } from '../../../../shared/src/therapy/clientSwitch.test-helpers';

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
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const makeClient = (o: Partial<Record<string, unknown>>) => ({
  telegramId: 0, name: '', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [], ...o,
});
const ALPHA = makeClient({ telegramId: 1, name: 'Альфа' });
const BETA = makeClient({ telegramId: 2, name: 'Бета' });
const CONCEPTS: Record<number, Record<string, unknown>> = {
  1: { id: 11, schemaIds: ['abandonment'], modeIds: ['vulnerable_child'], goals: 'цели Альфы', earlyExperience: 'детство Альфы' },
  2: { id: 22, schemaIds: ['defectiveness'], modeIds: [], goals: 'цели Беты', earlyExperience: 'детство Беты' },
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function setup() {
  return renderHook(() => useClientDetail({ onOpenClient: vi.fn(), switchView: vi.fn(), setClients: vi.fn() }));
}
type Hook = ReturnType<typeof setup>['result'];
async function open(result: Hook, client: ReturnType<typeof makeClient>) {
  await act(async () => { await result.current.openClient(client); });
}
const savedIds = () => mockApi.saveConceptualization.mock.calls.map(c => c[0]);

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getConceptualization.mockImplementation(async (id: number) => CONCEPTS[id] ?? null);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.saveConceptualization.mockImplementation(async (id: number, body: object) => ({ ...CONCEPTS[id], ...body }));
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe('концептуализация: правка у А и быстрая смена на Б', () => {
  it('сохранение уходит с id Альфы и ДАННЫМИ Альфы; Бета не тронута ни на сервере, ни на экране', async () => {
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { result.current.patchConcept({ goals: 'новые цели Альфы' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); }); // меньше 700 мс
    await open(result, BETA);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(savedIds()).toEqual([1]);
    expect(mockApi.saveConceptualization.mock.calls[0][1]).toMatchObject({
      goals: 'новые цели Альфы', earlyExperience: 'детство Альфы',
      schemaIds: ['abandonment'], modeIds: ['vulnerable_child'],
    });
    expect(result.current.localConcept.goals).toBe('цели Беты');
    expect(result.current.concept?.goals).toBe('цели Беты');
  });

  it('Бета ещё грузится — у Альфы не сохраняется пустая концептуализация', async () => {
    const betaConcept = deferred<Record<string, unknown>>();
    mockApi.getConceptualization.mockImplementation((id: number) => (id === 2 ? betaConcept.promise : Promise.resolve(CONCEPTS[1])));
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { result.current.patchConcept({ goals: 'новые цели Альфы' }); });
    act(() => { void result.current.openClient(BETA); }); // ответ Беты ещё в пути
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(savedIds()).toEqual([1]);
    expect(mockApi.saveConceptualization.mock.calls[0][1]).toMatchObject({
      goals: 'новые цели Альфы', schemaIds: ['abandonment'],
    });
    await act(async () => { betaConcept.resolve(CONCEPTS[2]); });
    expect(result.current.localConcept.goals).toBe('цели Беты');
  });

  it('ответ сохранения Альфы, пришедший после перехода к Бете, не попадает в карточку Беты', async () => {
    const alphaSave = deferred<Record<string, unknown>>();
    mockApi.saveConceptualization.mockImplementation(() => alphaSave.promise);
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { result.current.patchConcept({ goals: 'новые цели Альфы' }); });
    await open(result, BETA);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await act(async () => { alphaSave.resolve({ ...CONCEPTS[1], goals: 'новые цели Альфы' }); });

    expect(result.current.concept?.goals).toBe('цели Беты');
    expect(result.current.saveStatus).toBe('idle');
    expect(result.current.conceptError).toBe('');
  });
});

describe('черновик заметки сессии не переходит к другому клиенту', () => {
  it('текст и дата «Новой заметки» у Бориса пустые, «Сохранить» ему ничего не пишет', async () => {
    const { result } = setup();
    await open(result, ALPHA);
    act(() => {
      result.current.setNewNoteText('Алиса: обсуждали…');
      result.current.setNewNoteDate('2026-10-20');
    });
    await open(result, BETA);

    expect(result.current.newNoteText).toBe('');
    expect(result.current.newNoteDate).toBe('');
    await act(async () => { await result.current.addNote(); });
    expect(mockApi.createTherapistNote).not.toHaveBeenCalled();
  });

  it('заметка Алисы, сохранённая уже после перехода к Борису, не появляется у Бориса и не стирает его черновик', async () => {
    const saved = deferred<Record<string, unknown>>();
    mockApi.createTherapistNote.mockImplementation(() => saved.promise);
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { result.current.setNewNoteText('Алиса: обсуждали…'); });
    act(() => { void result.current.addNote(); });
    await open(result, BETA);
    act(() => { result.current.setNewNoteText('Борис: черновик'); });
    await act(async () => { saved.resolve({ id: 5, date: '2026-10-26', text: 'Алиса: обсуждали…' }); });

    expect(mockApi.createTherapistNote.mock.calls[0][0]).toBe(1);
    expect(result.current.notes.map(n => n.id)).toEqual([]);
    expect(result.current.newNoteText).toBe('Борис: черновик');
    expect(result.current.noteSaving).toBe(false);
  });
});

describe('уход со страницы в течение задержки автосохранения', () => {
  it('pagehide досылает правку сразу, keepalive-запросом, и таймер не шлёт её второй раз', async () => {
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { result.current.patchConcept({ goals: 'набрано перед закрытием' }); });
    act(() => { window.dispatchEvent(new Event('pagehide')); });

    expect(savedIds()).toEqual([1]);
    expect(mockApi.saveConceptualization.mock.calls[0][1]).toMatchObject({ goals: 'набрано перед закрытием' });
    expect(mockApi.saveConceptualization.mock.calls[0][2]).toEqual({ keepalive: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.saveStatus).toBe('saved'); // вкладка вернулась — не вечное «автосохранение»
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(savedIds()).toEqual([1]);
  });

  it('отказ досылки при уходе виден в карточке и уходит в телеметрию', async () => {
    mockApi.saveConceptualization.mockRejectedValueOnce(new Error('network'));
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { result.current.patchConcept({ goals: 'не долетело' }); });
    await act(async () => { window.dispatchEvent(new Event('pagehide')); });

    expect(result.current.saveStatus).toBe('error'); // «Не сохранилось» + «Повторить» в SaveStatusLine
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ section: 'therapist.clientDetail' }));
  });

  it('вкладка скрыта (visibilitychange → hidden) — правка тоже уходит сразу', async () => {
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { result.current.patchConcept({ goals: 'переключился на другую вкладку' }); });
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    } finally {
      visibility.mockRestore();
    }
    expect(savedIds()).toEqual([1]);
    expect(mockApi.saveConceptualization.mock.calls[0][1]).toMatchObject({ goals: 'переключился на другую вкладку' });
  });

  it('закрытие кабинета (размонтирование) досылает правку открытому клиенту', async () => {
    const { result, unmount } = setup();
    await open(result, ALPHA);
    act(() => { result.current.patchConcept({ goals: 'закрыл кабинет' }); });
    unmount();

    expect(savedIds()).toEqual([1]);
    expect(mockApi.saveConceptualization.mock.calls[0][1]).toMatchObject({ goals: 'закрыл кабинет' });
  });
});

describe('ответ имени и дат, пришедший после перехода, не возвращает прежнего клиента', () => {
  it('переименование Альфы не подменяет шапку Беты (иначе следующая правка ушла бы Альфе)', async () => {
    const renamed = deferred<void>();
    mockApi.renameClient.mockImplementation(() => renamed.promise);
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { result.current.setAliasInput('Альфа К.'); });
    act(() => { void result.current.saveAlias(); });
    await open(result, BETA);
    await act(async () => { renamed.resolve(); });

    expect(result.current.selectedClient?.telegramId).toBe(2);
    expect(result.current.aliasSaving).toBe(false);
  });

  it('даты сессии Альфы не подменяют карточку Беты', async () => {
    const updated = deferred<void>();
    mockApi.updateSessionInfo.mockImplementation(() => updated.promise);
    const { result } = setup();
    await open(result, ALPHA);
    act(() => { void result.current.saveSessionInfo({ nextSession: '2026-10-30' }); });
    await open(result, BETA);
    await act(async () => { updated.resolve(); });

    expect(result.current.selectedClient?.telegramId).toBe(2);
    expect(result.current.selectedClient?.nextSession).toBeNull();
    expect(result.current.sessionInfoSaving).toBe(false);
  });
});

describe('класс целиком: каждый черновик хука сбрасывается сменой клиента', () => {
  it('после смены клиента состояние совпадает с хуком, открывшим Бету с чистого листа', async () => {
    const fresh = setup();
    await open(fresh.result, BETA);
    const expected = visibleState(fresh.result.current);

    mockApi.updateSessionInfo.mockRejectedValueOnce(new Error('network'));
    const { result } = setup();
    await open(result, ALPHA);
    let unmatched: string[] = [];
    act(() => { unmatched = dirtyEverySetter(result.current, ['setSelectedClient']); });
    await act(async () => { await result.current.saveSessionInfo({ nextSession: '2026-10-30' }); });
    act(() => { result.current.patchConcept({ goals: 'правка Альфы' }); });
    await open(result, BETA);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(unmatched).toEqual([]);
    expect(visibleState(result.current)).toEqual(expected);
  });
});
