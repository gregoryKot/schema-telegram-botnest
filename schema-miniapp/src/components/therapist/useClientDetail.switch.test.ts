// @vitest-environment jsdom
// РЕГРЕССИЯ — инцидент 2026-10-26 (docs/INCIDENTS.md, класс «состояние одного
// клиента протекает в другого при смене клиента»), парная починка мини-аппа
// (правило №3). Автосохранения с таймером здесь нет (концептуализация — явной
// кнопкой), но черновик заметки не сбрасывался при открытии другого клиента,
// а ответы сохранения (концептуализация, имя, даты), пришедшие после
// перехода, записывались в карточку уже другого клиента.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientDetail } from './useClientDetail';
import {
  dirtyEverySetter,
  visibleState,
} from '../../../../shared/src/therapy/clientSwitch.test-helpers';

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
const mockApi = api as unknown as Record<
  string,
  Mock<(...args: unknown[]) => unknown>
>;

const makeClient = (o: Partial<Record<string, unknown>>) => ({
  telegramId: 0,
  name: '',
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
const ALPHA = makeClient({ telegramId: 1, name: 'Алиса' });
const BETA = makeClient({ telegramId: 2, name: 'Богдан' });
const CONCEPTS: Record<number, Record<string, unknown>> = {
  1: { id: 11, schemaIds: ['abandonment'], modeIds: [], goals: 'цели Алисы' },
  2: { id: 22, schemaIds: [], modeIds: [], goals: 'цели Богдана' },
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup() {
  return renderHook(() =>
    useClientDetail({ switchView: vi.fn(), setClients: vi.fn() }),
  );
}
type Hook = ReturnType<typeof setup>['result'];
async function open(result: Hook, client: ReturnType<typeof makeClient>) {
  await act(async () => {
    await result.current.openClient(client);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getConceptualization.mockImplementation((id) =>
    Promise.resolve(CONCEPTS[id as number] ?? null),
  );
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
});

describe('черновик заметки не переходит к другому клиенту', () => {
  it('текст «Новой заметки» у Богдана пустой, «Сохранить» ему ничего не пишет', async () => {
    const { result } = setup();
    await open(result, ALPHA);
    act(() => result.current.setNewNoteText('Алиса: обсуждали…'));
    await open(result, BETA);

    expect(result.current.newNoteText).toBe('');
    await act(async () => {
      await result.current.addNote();
    });
    expect(mockApi.createTherapistNote).not.toHaveBeenCalled();
  });

  it('заметка Алисы, сохранённая после перехода к Богдану, не появляется у Богдана', async () => {
    const saved = deferred<Record<string, unknown>>();
    mockApi.createTherapistNote.mockReturnValue(saved.promise);
    const { result } = setup();
    await open(result, ALPHA);
    act(() => result.current.setNewNoteText('Алиса: обсуждали…'));
    act(() => {
      void result.current.addNote();
    });
    await open(result, BETA);
    act(() => result.current.setNewNoteText('Богдан: черновик'));
    await act(async () => {
      saved.resolve({ id: 5, date: '2026-10-26', text: 'Алиса: обсуждали…' });
    });

    expect(mockApi.createTherapistNote.mock.calls[0][0]).toBe(1);
    expect(result.current.notes.map((n) => n.id)).toEqual([]);
    expect(result.current.newNoteText).toBe('Богдан: черновик');
    expect(result.current.noteSaving).toBe(false);
  });
});

describe('ответ сохранения, пришедший после перехода, не трогает другого клиента', () => {
  it('концептуализация: ответ для Алисы не попадает в карточку Богдана', async () => {
    const save = deferred<Record<string, unknown>>();
    mockApi.saveConceptualization.mockReturnValue(save.promise);
    const { result } = setup();
    await open(result, ALPHA);
    act(() => result.current.patchConcept({ goals: 'новые цели Алисы' }));
    act(() => {
      void result.current.saveConcept();
    });
    await open(result, BETA);
    await act(async () => {
      save.resolve({ ...CONCEPTS[1], goals: 'новые цели Алисы' });
    });

    expect(mockApi.saveConceptualization.mock.calls[0][0]).toBe(1);
    expect(result.current.concept?.goals).toBe('цели Богдана');
    expect(result.current.localConcept.goals).toBe('цели Богдана');
    expect(result.current.conceptSaving).toBe(false);
  });

  it('имя: переименование Алисы не возвращает её в шапку карточки Богдана', async () => {
    const renamed = deferred<void>();
    mockApi.renameClient.mockReturnValue(renamed.promise);
    const { result } = setup();
    await open(result, ALPHA);
    act(() => result.current.setAliasInput('Алиса К.'));
    act(() => {
      void result.current.saveAlias();
    });
    await open(result, BETA);
    await act(async () => {
      renamed.resolve();
    });

    expect(result.current.selectedClient?.telegramId).toBe(2);
    expect(result.current.aliasSaving).toBe(false);
  });

  it('даты сессии: ответ для Алисы не возвращает её в карточку Богдана', async () => {
    const updated = deferred<void>();
    mockApi.updateSessionInfo.mockReturnValue(updated.promise);
    const { result } = setup();
    await open(result, ALPHA);
    act(() => {
      void result.current.saveSessionInfo({ nextSession: '2026-10-30' });
    });
    await open(result, BETA);
    await act(async () => {
      updated.resolve();
    });

    expect(result.current.selectedClient?.telegramId).toBe(2);
    expect(result.current.selectedClient?.nextSession).toBeNull();
    expect(result.current.sessionInfoSaving).toBe(false);
  });
});

describe('класс целиком: каждый черновик хука сбрасывается сменой клиента', () => {
  it('после смены клиента состояние совпадает с хуком, открывшим Богдана с чистого листа', async () => {
    const fresh = setup();
    await open(fresh.result, BETA);
    const expected = visibleState(fresh.result.current);

    mockApi.updateSessionInfo.mockRejectedValueOnce(new Error('network'));
    const { result } = setup();
    await open(result, ALPHA);
    let unmatched: string[] = [];
    act(() => {
      unmatched = dirtyEverySetter(result.current, ['setSelectedClient']);
    });
    await act(async () => {
      await result.current.saveSessionInfo({ nextSession: '2026-10-30' });
    });
    await open(result, BETA);

    expect(unmatched).toEqual([]);
    expect(visibleState(result.current)).toEqual(expected);
  });
});
