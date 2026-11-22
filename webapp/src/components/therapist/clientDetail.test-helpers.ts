// Карточка клиента для тестов вкладок: полный объект `useClientDetail` без каста.
// Новое поле хука ломает компиляцию здесь, в одном месте, а не падением тестов вкладок.
import { vi } from 'vitest';
import type { TherapyClientSummary } from '../../api';
import { EMPTY_NOTES_PAGE } from '../../../../shared/src/therapy/notesPage';
import type { ClientDetail } from './clientSheetTypes';

export function makeClient(over: Partial<TherapyClientSummary> = {}): TherapyClientSummary {
  return {
    telegramId: 7, name: null, clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
    recentIndexHistory: [], relationCreatedAt: '2026-01-01T00:00:00.000Z', therapyStartDate: null,
    nextSession: null, meetingDays: [], schemaIds: [], ...over,
  };
}

type Concept = NonNullable<ClientDetail['concept']>;
/** Концептуализация из нужных тесту полей: остальных у строки в тесте нет. */
export const partialConcept = (fields: Partial<Concept>) => fields as Concept;

/** Пустая карточка: клиента нет, списки пустые, обработчики — `vi.fn()`. */
export function makeClientDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    openClientIdRef: { current: null },
    selectedClient: null, setSelectedClient: vi.fn(),
    clientSchemaNotesData: [], clientModeNotesData: [],
    clientTasks: [], setClientTasks: vi.fn(),
    notes: [], notesPage: EMPTY_NOTES_PAGE, noteError: '',
    concept: null, conceptLoad: { failed: false, reloading: false }, reloadConcept: vi.fn(),
    clientData: null, clientHistory: [], clientDiary: [],
    localConcept: {}, conceptError: '', expandedSnapshot: null, setExpandedSnapshot: vi.fn(),
    saveStatus: 'idle', savedAt: null, retrySave: vi.fn(),
    newNoteText: '', setNewNoteText: vi.fn(),
    newNoteDate: '', setNewNoteDate: vi.fn(),
    newNoteWork: [], setNewNoteWork: vi.fn(), newNotePlanIds: [], setNewNotePlanIds: vi.fn(),
    noteSaving: false, showAssign: false, setShowAssign: vi.fn(),
    editingStartDate: false, setEditingStartDate: vi.fn(),
    localStartDate: '', setLocalStartDate: vi.fn(),
    editingNextSession: false, setEditingNextSession: vi.fn(),
    localNextSession: '', setLocalNextSession: vi.fn(),
    sessionInfoSaving: false, sessionInfoError: '',
    renamingAlias: false, setRenamingAlias: vi.fn(),
    aliasInput: '', setAliasInput: vi.fn(),
    aliasSaving: false, aliasError: '',
    ysqRequested: false, ysqError: '',
    exportCopied: false, exportEmpty: false,
    deleteLoading: false, deleteError: '', confirmingDelete: false,
    tabLoading: false, clientTab: 'overview', setClientTab: vi.fn(),
    activeSchemaIds: [], activeModeIds: [], ysqSchemaIds: [], selfSchemaIds: [],
    openClient: vi.fn(), deleteClient: vi.fn(), requestDeleteClient: vi.fn(), cancelDeleteClient: vi.fn(),
    addNote: vi.fn(), removeNote: vi.fn(), onTaskAssigned: vi.fn(),
    patchConcept: vi.fn(), restoreConcept: vi.fn(),
    toggleSchemaId: vi.fn(), toggleModeId: vi.fn(),
    saveAlias: vi.fn(), saveSessionInfo: vi.fn(),
    handleRequestYsq: vi.fn(), handleExport: vi.fn(),
    ...overrides,
  };
}
