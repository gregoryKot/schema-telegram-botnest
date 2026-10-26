import { useRef, useState } from 'react';
import { api, reportClientError, type UserId } from '../../api';
import { sameId } from '../../../../shared/src/utils/sameId';
import type { TherapyClientSummary, UserTask, ClientData } from '../../api';
import { useNoteComposer } from '../../../../shared/src/therapy/useNoteComposer';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { useYsqRequest } from '../../../../shared/src/therapy/useYsqRequest';
import { removeClientConfirmCopy } from '../../../../shared/src/therapy/removeClientConfirm';
import { reloadClientTasks } from '../../../../shared/src/therapy/reloadClientTasks';
import {
  fetchClientDetail,
  type ClientSchemaNoteRow,
  type ClientModeNoteRow,
} from './fetchClientDetail';
import { useConceptEditing } from './useConceptEditing';
import { useSessionAliasEditing } from '../../../../shared/src/therapy/useSessionAliasEditing';
import { buildConceptExport } from './conceptExport';
interface Params {
  switchView: (v: 'list' | 'client') => void;
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

// Фасад карточки клиента терапевта (правило №10: 476 строк → композиция).
// Форма возврата (ClientDetail = ReturnType) не изменилась; реализация:
// useConceptEditing.ts (концептуализация), shared useSessionAliasEditing.ts
// (сессии/алиас, общий с сайтом), conceptExport.ts (текст экспорта).
// Класс «состояние одного клиента протекает в другого» (инцидент 2026-10-26,
// docs/INCIDENTS.md): черновики сбрасываются в openClient, ответы после смены
// клиента его карточку не трогают — проверяет useClientDetail.switch.test.ts.
export function useClientDetail({ switchView, setClients }: Params) {
  const openClientIdRef = useRef<UserId | null>(null);
  const isOpen = (id: UserId) => sameId(openClientIdRef.current, id);

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
  const notes = useNoteComposer(openClientIdRef, {
    create: api.createTherapistNote,
    remove: api.deleteTherapistNote,
  });
  const [clientData, setClientData] = useState<ClientData | null>(null);
  // Хотя бы один из шести запросов карточки клиента упал (см.
  // fetchClientDetail) — терапевту нужно знать, что видимая пустота может
  // быть сбоем сети, а не «у клиента правда ничего нет».
  const [clientLoadError, setClientLoadError] = useState(false);

  const [showAssign, setShowAssign] = useState(false);

  const conceptEditing = useConceptEditing(selectedClient, openClientIdRef);
  const sessionAlias = useSessionAliasEditing({
    selectedClient,
    setSelectedClient,
    setClients,
    openClientIdRef,
    send: api,
    sessionError: { text: 'Не удалось сохранить', clearAfterMs: 3000 },
  });

  // YSQ / Export
  const {
    ysqRequested,
    ysqError,
    setYsqRequested,
    resetYsq,
    handleRequestYsq,
  } = useYsqRequest(selectedClient?.telegramId, (id) => api.requestYsq(id));
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
    notes.resetNotes(); // черновик заметки — только своему клиенту
    setShowAssign(false);
    setClientData(null);
    setClientLoadError(false);
    conceptEditing.resetConcept();
    resetYsq();
    setDeleteError('');
    sessionAlias.resetSessionAlias(client);
    switchView('client');

    const fetched = await fetchClientDetail(clientId);

    // Discard stale results if user switched to a different client
    if (!sameId(openClientIdRef.current, clientId)) return;

    setClientTasks(fetched.tasks);
    notes.setNotesPage(fetched.notesPage);
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
    const { title, message } = removeClientConfirmCopy(selectedClient);
    if (!window.confirm(`${title}\n\n${message}`)) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.removeClient(selectedClient.telegramId);
      setClients((prev) =>
        prev.filter((c) => !sameId(c.telegramId, selectedClient.telegramId)),
      );
      if (isOpen(selectedClient.telegramId)) switchView('list');
    } catch {
      setDeleteError('Не удалось удалить клиента');
    } finally {
      setDeleteLoading(false);
    }
  }

  function onTaskAssigned() {
    setShowAssign(false);
    if (selectedClient)
      reloadClientTasks(
        selectedClient.telegramId,
        isOpen,
        api.getTherapyTasksForClient,
        setClientTasks,
      );
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
    notes: notes.notesPage.notes,
    notesPage: notes.notesPage,
    noteError: notes.noteError,
    setNoteError: notes.setNoteError,
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
    newNoteText: notes.newNoteText,
    setNewNoteText: notes.setNewNoteText,
    noteSaving: notes.noteSaving,
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
    addNote: notes.addNote,
    removeNote: notes.removeNote,
    onTaskAssigned,
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
