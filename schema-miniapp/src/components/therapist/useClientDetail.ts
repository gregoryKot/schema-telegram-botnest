import { useRef, useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import type {
  TherapyClientSummary,
  UserTask,
  TherapistNote,
  ClientConceptualization,
  ClientData,
} from '../../api';
import { fmtDate, todayStr } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';

interface Params {
  switchView: (v: 'list' | 'client') => void;
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

export function useClientDetail({ switchView, setClients }: Params) {
  const tr = useTr();
  const openClientIdRef = useRef<number | null>(null);

  // Selected client + all its data
  const [selectedClient, setSelectedClient] =
    useState<TherapyClientSummary | null>(null);
  const [showTasksSheet, setShowTasksSheet] = useState(false);
  const [showNotesSheet, setShowNotesSheet] = useState(false);
  const [showConceptSheet, setShowConceptSheet] = useState(false);
  const [showClientNotesSheet, setShowClientNotesSheet] = useState(false);
  const [clientSchemaNotesData, setClientSchemaNotesData] = useState<
    Array<{
      schemaId: string;
      triggers: string;
      feelings: string;
      thoughts: string;
      origins: string;
      reality: string;
      healthyView: string;
      behavior: string;
    }>
  >([]);
  const [clientModeNotesData, setClientModeNotesData] = useState<
    Array<{
      modeId: string;
      triggers: string;
      feelings: string;
      thoughts: string;
      needs: string;
      behavior: string;
    }>
  >([]);
  const [clientTasks, setClientTasks] = useState<UserTask[]>([]);
  const [notes, setNotes] = useState<TherapistNote[]>([]);
  const [noteError, setNoteError] = useState('');
  const [concept, setConcept] = useState<ClientConceptualization | null>(null);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [localConcept, setLocalConcept] = useState<
    Partial<ClientConceptualization>
  >({});
  const [conceptDirty, setConceptDirty] = useState(false);
  const [conceptSaving, setConceptSaving] = useState(false);
  const [conceptError, setConceptError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Notes composer
  const [newNoteText, setNewNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  // Session info editing
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [localStartDate, setLocalStartDate] = useState('');
  const [editingNextSession, setEditingNextSession] = useState(false);
  const [localNextSession, setLocalNextSession] = useState('');
  const [editingDays, setEditingDays] = useState(false);
  const [localMeetingDays, setLocalMeetingDays] = useState<number[]>([]);
  const [sessionInfoSaving, setSessionInfoSaving] = useState(false);
  const [sessionInfoError, setSessionInfoError] = useState('');

  // Alias editing
  const [renamingAlias, setRenamingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasError, setAliasError] = useState('');

  // YSQ / Export
  const [ysqRequested, setYsqRequested] = useState(false);
  const [ysqError, setYsqError] = useState('');
  const [exportCopied, setExportCopied] = useState(false);

  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Derived ────────────────────────────────────────────────────────────────────
  const activeSchemaIds = localConcept.schemaIds ?? concept?.schemaIds ?? [];
  const activeModeIds = localConcept.modeIds ?? concept?.modeIds ?? [];
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
    setConcept(null);
    setClientData(null);
    setLocalConcept({});
    setConceptDirty(false);
    setConceptError('');
    setShowHistory(false);
    setYsqRequested(false);
    setYsqError('');
    setRenamingAlias(false);
    setAliasError('');
    setDeleteError('');
    setEditingStartDate(false);
    setEditingNextSession(false);
    setEditingDays(false);
    setLocalMeetingDays(client.meetingDays ?? []);
    setLocalNextSession(client.nextSession ?? '');
    setLocalStartDate(client.therapyStartDate ?? '');
    switchView('client');

    const [tasks, fetchedNotes, fetchedConcept, fetchedData, sn, mn] =
      await Promise.all([
        api.getTherapyTasksForClient(clientId).catch(() => []),
        api.getTherapistNotes(clientId).catch(() => []),
        api.getConceptualization(clientId).catch(() => null),
        api.getTherapyClientData(clientId).catch(() => null),
        api.getClientSchemaNotes(clientId).catch(() => []),
        api.getClientModeNotes(clientId).catch(() => []),
      ]);

    // Discard stale results if user switched to a different client
    if (openClientIdRef.current !== clientId) return;

    setClientTasks(tasks);
    setNotes(fetchedNotes);
    setConcept(fetchedConcept);
    setClientData(fetchedData);
    setClientSchemaNotesData(sn);
    setClientModeNotesData(mn);
    if (fetchedConcept) setLocalConcept(fetchedConcept);
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

  // ── Conceptualization ──────────────────────────────────────────────────────────
  function patchConcept(patch: Partial<ClientConceptualization>) {
    setLocalConcept((prev) => ({ ...prev, ...patch }));
    setConceptDirty(true);
  }

  function toggleSchemaId(id: string) {
    const current = localConcept.schemaIds ?? concept?.schemaIds ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    patchConcept({ schemaIds: next });
  }

  function toggleModeId(id: string) {
    const current = localConcept.modeIds ?? concept?.modeIds ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    patchConcept({ modeIds: next });
  }

  async function saveConcept() {
    if (!selectedClient || !conceptDirty) return;
    setConceptSaving(true);
    setConceptError('');
    try {
      const saved = await api.saveConceptualization(selectedClient.telegramId, {
        schemaIds: localConcept.schemaIds ?? [],
        modeIds: localConcept.modeIds ?? [],
        earlyExperience: (localConcept.earlyExperience as string) ?? '',
        unmetNeeds: (localConcept.unmetNeeds as string) ?? '',
        triggers: (localConcept.triggers as string) ?? '',
        copingStyles: (localConcept.copingStyles as string) ?? '',
        goals: (localConcept.goals as string) ?? '',
        currentProblems: (localConcept.currentProblems as string) ?? '',
        modeTransitions: (localConcept.modeTransitions as string) ?? '',
      });
      setConcept(saved);
      setLocalConcept(saved);
      setConceptDirty(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setConceptError(
        msg.startsWith('API')
          ? tr(
              'Ошибка сервера. Попробуй позже.',
              'Ошибка сервера. Попробуйте позже.',
            )
          : msg || 'Ошибка сохранения',
      );
    } finally {
      setConceptSaving(false);
    }
  }

  // ── Alias ──────────────────────────────────────────────────────────────────────
  async function saveAlias() {
    if (!selectedClient) return;
    setAliasSaving(true);
    setAliasError('');
    try {
      await api.renameClient(selectedClient.telegramId, aliasInput);
      const updated = {
        ...selectedClient,
        clientAlias: aliasInput.trim() || null,
      };
      setSelectedClient(updated);
      setClients((prev) =>
        prev.map((c) =>
          c.telegramId === selectedClient.telegramId ? updated : c,
        ),
      );
      setRenamingAlias(false);
    } catch {
      setAliasError('Не удалось сохранить имя');
    } finally {
      setAliasSaving(false);
    }
  }

  // ── Session info ───────────────────────────────────────────────────────────────
  async function saveSessionInfo(patch: {
    therapyStartDate?: string | null;
    nextSession?: string | null;
    meetingDays?: number[];
  }) {
    if (!selectedClient) return;
    setSessionInfoSaving(true);
    setSessionInfoError('');
    try {
      await api.updateSessionInfo(selectedClient.telegramId, patch);
      const updated = { ...selectedClient, ...patch };
      if (patch.meetingDays !== undefined)
        updated.meetingDays = patch.meetingDays;
      setSelectedClient(updated);
      setClients((prev) =>
        prev.map((c) =>
          c.telegramId === selectedClient.telegramId ? updated : c,
        ),
      );
    } catch {
      setSessionInfoError('Не удалось сохранить');
      setTimeout(() => setSessionInfoError(''), 3000);
    } finally {
      setSessionInfoSaving(false);
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
  function buildExportText(): string {
    if (!selectedClient || !concept) return '';
    const therapistName =
      window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name ?? 'Терапевт';
    const clientName =
      selectedClient.clientAlias ??
      selectedClient.name ??
      `ID ${selectedClient.telegramId}`;
    const date = concept.updatedAt
      ? fmtDate(concept.updatedAt.slice(0, 10))
      : todayStr();
    const c = { ...concept, ...localConcept };
    const schemaNames = activeSchemaIds.map((id) => {
      const s = SCHEMA_DOMAINS.flatMap((d) => d.schemas).find(
        (x) => x.id === id,
      );
      return s ? `${s.emoji} ${s.name}` : id;
    });
    const modeNames = activeModeIds.map((id) => {
      const m = MODE_GROUPS.flatMap((g) => g.items).find((x) => x.id === id);
      return m ? `${m.emoji} ${m.name}` : id;
    });
    const row = (label: string, value: string | null | undefined) =>
      `${label}\n${value?.trim() || '—'}\n`;
    const div = '─'.repeat(44);
    return [
      `Терапевт: ${therapistName}   Клиент: ${clientName}   Дата: ${date}`,
      '',
      '══════ КРАТКАЯ КОНЦЕПТУАЛИЗАЦИЯ ══════',
      '',
      div,
      row('АКТУАЛЬНЫЕ СХЕМЫ (ЭДС)', schemaNames.join(' · ') || null),
      div,
      row('КАРТА РЕЖИМОВ', modeNames.join(' · ') || null),
      div,
      row('РАННИЙ ДИСФУНКЦИОНАЛЬНЫЙ ОПЫТ', c.earlyExperience),
      div,
      row('НЕУДОВЛЕТВОРЁННЫЕ БАЗОВЫЕ ПОТРЕБНОСТИ', c.unmetNeeds),
      div,
      row('СХЕМНЫЕ ТРИГГЕРЫ', c.triggers),
      div,
      row('ДЕЗАДАПТИВНЫЕ КОПИНГИ', c.copingStyles),
      div,
      row('АКТУАЛЬНЫЕ ПРОБЛЕМЫ И СИМПТОМЫ', c.currentProblems),
      div,
      row('ЦЕЛИ СХЕМА-ТЕРАПИИ', c.goals),
      div,
      '',
      '@SchemeHappens · Всё по схеме',
    ].join('\n');
  }

  async function handleExport() {
    const text = buildExportText();
    if (!text) return;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* fallthrough */
    }
    try {
      await navigator.clipboard.writeText(text);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2500);
    } catch {
      /* ignore */
    }
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
    concept,
    clientData,
    localConcept,
    setLocalConcept,
    conceptDirty,
    setConceptDirty,
    conceptSaving,
    conceptError,
    showHistory,
    setShowHistory,
    newNoteText,
    setNewNoteText,
    noteSaving,
    showAssign,
    setShowAssign,
    editingStartDate,
    setEditingStartDate,
    localStartDate,
    setLocalStartDate,
    editingNextSession,
    setEditingNextSession,
    localNextSession,
    setLocalNextSession,
    editingDays,
    setEditingDays,
    localMeetingDays,
    setLocalMeetingDays,
    sessionInfoSaving,
    sessionInfoError,
    renamingAlias,
    setRenamingAlias,
    aliasInput,
    setAliasInput,
    aliasSaving,
    aliasError,
    setAliasError,
    ysqRequested,
    setYsqRequested,
    ysqError,
    exportCopied,
    deleteLoading,
    deleteError,
    // Derived
    activeSchemaIds,
    activeModeIds,
    ysqSchemaIds,
    selfSchemaIds,
    // Handlers
    openClient,
    deleteClient,
    addNote,
    removeNote,
    patchConcept,
    toggleSchemaId,
    toggleModeId,
    saveConcept,
    saveAlias,
    saveSessionInfo,
    handleRequestYsq,
    handleExport,
  };
}
