import { useRef, useState } from 'react';
import { api, reportClientError } from '../../api';
import type {
  TherapyClientSummary,
  UserTask,
  TherapistNote,
  ClientData,
} from '../../api';
import { todayStr } from '../../utils/format';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import {
  fetchClientDetail,
  type ClientSchemaNoteRow,
  type ClientModeNoteRow,
} from './fetchClientDetail';
import { useConceptEditing } from './useConceptEditing';
import { useSessionAliasEditing } from './useSessionAliasEditing';
import { buildConceptExport } from './conceptExport';

interface Params {
  switchView: (v: 'list' | 'client') => void;
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

// Фасад карточки клиента терапевта (правило №10: 476 строк → композиция).
// Форма возврата (ClientDetail = ReturnType) не изменилась; реализация:
// useConceptEditing.ts (концептуализация), useSessionAliasEditing.ts
// (сессии/алиас), conceptExport.ts (текст экспорта).
export function useClientDetail({ switchView, setClients }: Params) {
  const openClientIdRef = useRef<number | null>(null);

  // Selected client + all its data
  const [selectedClient, setSelectedClient] =
    useState<TherapyClientSummary | null>(null);
  const [showTasksSheet, setShowTasksSheet] = useState(false);
  const [showNotesSheet, setShowNotesSheet] = useState(false);
  const [showConceptSheet, setShowConceptSheet] = useState(false);
  const [showClientNotesSheet, setShowClientNotesSheet] = useState(false);
  const [clientSchemaNotesData, setClientSchemaNotesData] = useState<
    ClientSchemaNoteRow[]
  >([]);
  const [clientModeNotesData, setClientModeNotesData] = useState<
    ClientModeNoteRow[]
  >([]);
  const [clientTasks, setClientTasks] = useState<UserTask[]>([]);
  const [notes, setNotes] = useState<TherapistNote[]>([]);
  const [noteError, setNoteError] = useState('');
  const [clientData, setClientData] = useState<ClientData | null>(null);
  // Хотя бы один из шести запросов карточки клиента упал (см.
  // fetchClientDetail) — терапевту нужно знать, что видимая пустота может
  // быть сбоем сети, а не «у клиента правда ничего нет».
  const [clientLoadError, setClientLoadError] = useState(false);

  // Notes composer
  const [newNoteText, setNewNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const conceptEditing = useConceptEditing(selectedClient);
  const sessionAlias = useSessionAliasEditing({
    selectedClient,
    setSelectedClient,
    setClients,
  });

  // YSQ / Export
  const [ysqRequested, setYsqRequested] = useState(false);
  const [ysqError, setYsqError] = useState('');
  const { copied: exportCopied, copy: copyExport } = useCopyToClipboard({
    onError: () =>
      reportClientError({
        message: 'export clipboard failed',
        section: 'therapist.clientDetail',
      }),
  });
  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Derived ────────────────────────────────────────────────────────────────────
  const ysqSchemaIds = clientData?.ysqActiveSchemaIds ?? [];
  const selfSchemaIds = clientData?.mySchemaIds ?? [];

  // ── Open client ────────────────────────────────────────────────────────────────
  async function openClient(client: TherapyClientSummary) {
    const clientId = client.telegramId;
    openClientIdRef.current = clientId;

    setSelectedClient(client);
    setShowTasksSheet(false);
    setShowNotesSheet(false);
    setShowConceptSheet(false);
    setShowClientNotesSheet(false);
    setClientSchemaNotesData([]);
    setClientModeNotesData([]);
    setClientTasks([]);
    setNotes([]);
    setNoteError('');
    setClientData(null);
    setClientLoadError(false);
    conceptEditing.resetConcept();
    setYsqRequested(false);
    setYsqError('');
    setDeleteError('');
    sessionAlias.resetSessionAlias(client);
    switchView('client');

    const fetched = await fetchClientDetail(clientId);

    // Discard stale results if user switched to a different client
    if (openClientIdRef.current !== clientId) return;

    setClientTasks(fetched.tasks);
    setNotes(fetched.notes);
    conceptEditing.setConcept(fetched.concept);
    setClientData(fetched.clientData);
    setClientSchemaNotesData(fetched.schemaNotes);
    setClientModeNotesData(fetched.modeNotes);
    setClientLoadError(fetched.loadError);
    if (fetched.concept) conceptEditing.setLocalConcept(fetched.concept);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────────
  async function deleteClient() {
    if (!selectedClient) return;
    const name =
      selectedClient.clientAlias ?? selectedClient.name ?? 'этого клиента';
    if (
      !window.confirm(
        `Удалить ${name}? Связь будет разорвана, данные сохранятся.`,
      )
    )
      return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.removeClient(selectedClient.telegramId);
      setClients((prev) =>
        prev.filter((c) => c.telegramId !== selectedClient.telegramId),
      );
      switchView('list');
    } catch {
      setDeleteError('Не удалось удалить клиента');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Notes ──────────────────────────────────────────────────────────────────────
  async function addNote() {
    if (!selectedClient || !newNoteText.trim()) return;
    setNoteSaving(true);
    setNoteError('');
    try {
      const note = await api.createTherapistNote(
        selectedClient.telegramId,
        todayStr(),
        newNoteText.trim(),
      );
      setNotes((prev) => [note, ...prev]);
      setNewNoteText('');
    } catch {
      setNoteError('Не удалось сохранить заметку');
    } finally {
      setNoteSaving(false);
    }
  }

  async function removeNote(noteId: number) {
    try {
      await api.deleteTherapistNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      setNoteError('Не удалось удалить заметку');
    }
  }

  // ── YSQ ───────────────────────────────────────────────────────────────────────
  async function handleRequestYsq() {
    if (!selectedClient) return;
    setYsqError('');
    try {
      await api.requestYsq(selectedClient.telegramId);
      setYsqRequested(true);
      setTimeout(() => setYsqRequested(false), 3000);
    } catch {
      setYsqError('Не удалось отправить запрос');
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────────
  async function handleExport() {
    const text = buildConceptExport({
      selectedClient,
      concept: conceptEditing.concept,
      localConcept: conceptEditing.localConcept,
      activeSchemaIds: conceptEditing.activeSchemaIds,
      activeModeIds: conceptEditing.activeModeIds,
    });
    if (!text) return;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* fallthrough */
    }
    await copyExport(text);
  }

  return {
    openClientIdRef,
    // State
    selectedClient,
    setSelectedClient,
    showTasksSheet,
    setShowTasksSheet,
    showNotesSheet,
    setShowNotesSheet,
    showConceptSheet,
    setShowConceptSheet,
    showClientNotesSheet,
    setShowClientNotesSheet,
    clientSchemaNotesData,
    clientModeNotesData,
    clientTasks,
    setClientTasks,
    notes,
    noteError,
    setNoteError,
    concept: conceptEditing.concept,
    clientData,
    clientLoadError,
    localConcept: conceptEditing.localConcept,
    setLocalConcept: conceptEditing.setLocalConcept,
    conceptDirty: conceptEditing.conceptDirty,
    setConceptDirty: conceptEditing.setConceptDirty,
    conceptSaving: conceptEditing.conceptSaving,
    conceptError: conceptEditing.conceptError,
    showHistory: conceptEditing.showHistory,
    setShowHistory: conceptEditing.setShowHistory,
    newNoteText,
    setNewNoteText,
    noteSaving,
    showAssign,
    setShowAssign,
    editingStartDate: sessionAlias.editingStartDate,
    setEditingStartDate: sessionAlias.setEditingStartDate,
    localStartDate: sessionAlias.localStartDate,
    setLocalStartDate: sessionAlias.setLocalStartDate,
    editingNextSession: sessionAlias.editingNextSession,
    setEditingNextSession: sessionAlias.setEditingNextSession,
    localNextSession: sessionAlias.localNextSession,
    setLocalNextSession: sessionAlias.setLocalNextSession,
    editingDays: sessionAlias.editingDays,
    setEditingDays: sessionAlias.setEditingDays,
    localMeetingDays: sessionAlias.localMeetingDays,
    setLocalMeetingDays: sessionAlias.setLocalMeetingDays,
    sessionInfoSaving: sessionAlias.sessionInfoSaving,
    sessionInfoError: sessionAlias.sessionInfoError,
    renamingAlias: sessionAlias.renamingAlias,
    setRenamingAlias: sessionAlias.setRenamingAlias,
    aliasInput: sessionAlias.aliasInput,
    setAliasInput: sessionAlias.setAliasInput,
    aliasSaving: sessionAlias.aliasSaving,
    aliasError: sessionAlias.aliasError,
    setAliasError: sessionAlias.setAliasError,
    ysqRequested,
    setYsqRequested,
    ysqError,
    exportCopied,
    deleteLoading,
    deleteError,
    // Derived
    activeSchemaIds: conceptEditing.activeSchemaIds,
    activeModeIds: conceptEditing.activeModeIds,
    ysqSchemaIds,
    selfSchemaIds,
    // Handlers
    openClient,
    deleteClient,
    addNote,
    removeNote,
    patchConcept: conceptEditing.patchConcept,
    toggleSchemaId: conceptEditing.toggleSchemaId,
    toggleModeId: conceptEditing.toggleModeId,
    saveConcept: conceptEditing.saveConcept,
    saveAlias: sessionAlias.saveAlias,
    saveSessionInfo: sessionAlias.saveSessionInfo,
    handleRequestYsq,
    handleExport,
  };
}
