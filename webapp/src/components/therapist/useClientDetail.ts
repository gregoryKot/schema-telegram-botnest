import { useRef, useState } from 'react';
import { api, reportClientError, type TherapyClientSummary, type UserTask, type ClientData, type UserId } from '../../api';
import { useNoteComposer } from '../../../../shared/src/therapy/useNoteComposer';
import { useSessionAliasEditing } from '../../../../shared/src/therapy/useSessionAliasEditing';
import { sameId } from '../../../../shared/src/utils/sameId';
import { fmtDate, momentDayKey, todayStr } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { useYsqRequest } from '../../../../shared/src/therapy/useYsqRequest';
import { formatConceptLinksExport } from '../../../../shared/src/therapy/conceptGraph/conceptLinksExport';
import { reloadClientTasks } from '../../../../shared/src/therapy/reloadClientTasks';
import { useConceptAutosave } from './useConceptAutosave';
type ClientTab = 'overview' | 'concept' | 'mode_map' | 'sessions' | 'tasks' | 'ysq' | 'client_notes';

interface Params {
  onOpenClient?: (id: UserId) => void;
  switchView: (v: 'list' | 'client') => void;
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

// Класс «состояние одного клиента протекает в другого» (инцидент 2026-10-26,
// docs/INCIDENTS.md): каждый черновик ввода сбрасывается в openClient, а
// ответ сохранения, пришедший после смены клиента, state карточки не трогает
// (isOpen). Всё, что хук отдаёт с сеттером, проверяет useClientDetail.switch.test.ts.
export function useClientDetail({ onOpenClient, switchView, setClients }: Params) {
  const openClientIdRef = useRef<UserId | null>(null);
  const isOpen = (id: UserId) => sameId(openClientIdRef.current, id);

  // Selected client + all its data
  const [selectedClient, setSelectedClient] = useState<TherapyClientSummary | null>(null);
  const [clientSchemaNotesData, setClientSchemaNotesData] = useState<Array<{
    schemaId: string; triggers: string; feelings: string; thoughts: string;
    origins: string; reality: string; healthyView: string; behavior: string;
  }>>([]);
  const [clientModeNotesData, setClientModeNotesData] = useState<Array<{
    modeId: string; triggers: string; feelings: string; thoughts: string;
    needs: string; behavior: string; origins: string; healthyView: string;
    modeFunction: string; needsMet: string;
  }>>([]);
  const [clientTasks, setClientTasks] = useState<UserTask[]>([]);
  const notes = useNoteComposer(openClientIdRef, { create: api.createTherapistNote, remove: api.deleteTherapistNote });
  const conceptSave = useConceptAutosave(openClientIdRef);
  const { concept, localConcept, activeSchemaIds, activeModeIds } = conceptSave;
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [clientHistory, setClientHistory] = useState<{ date: string; index: number | null; ratings: Record<string, number> }[]>([]);
  const [clientDiary, setClientDiary] = useState<{ type: 'schema' | 'mode' | 'gratitude'; date: string; schemaIds?: string[]; modeId?: string; excerpt: string }[]>([]);
  const [expandedSnapshot, setExpandedSnapshot] = useState<number | null>(null);

  const [showAssign, setShowAssign] = useState(false);
  // Даты сессий и имя — общий хук обоих фронтов (shared/src/therapy/useSessionAliasEditing.ts)
  const sa = useSessionAliasEditing({
    selectedClient, setSelectedClient, setClients, openClientIdRef,
    send: api, sessionError: { text: 'Не удалось сохранить дату' },
  });

  // YSQ / Export
  const { ysqRequested, ysqError, resetYsq, handleRequestYsq } = useYsqRequest(
    selectedClient?.telegramId, (id) => api.requestYsq(id));
  const { copied: exportCopied, copy: copyExport } = useCopyToClipboard({
    onError: () => reportClientError({ message: 'client detail export clipboard write failed', section: 'therapist.clientDetail' }),
  });

  // Delete — Ж4 (аудит 2026-08): нативный confirm() заменён на ConfirmDialog
  // (рендерится в ClientHeader); confirmingDelete переключает его видимость.
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // UI
  const [tabLoading, setTabLoading] = useState(false);
  const [clientTab, setClientTab] = useState<ClientTab>('overview');

  // ── Derived ────────────────────────────────────────────────────────────────────
  const ysqSchemaIds = clientData?.ysqActiveSchemaIds ?? [];
  const selfSchemaIds = clientData?.mySchemaIds ?? [];

  // ── Open client ────────────────────────────────────────────────────────────────
  async function openClient(client: TherapyClientSummary) {
    const clientId = client.telegramId;
    conceptSave.resetForClient(); // ожидающая правка уходит ПРЕЖНЕМУ клиенту, с его данными
    openClientIdRef.current = clientId;

    setSelectedClient(client);
    setClientSchemaNotesData([]);
    setClientModeNotesData([]);
    setClientTasks([]);
    notes.resetNotes(); // черновик заметки (текст, дата) — только своему клиенту
    setShowAssign(false);
    setClientData(null);
    setClientHistory([]);
    setClientDiary([]);
    setExpandedSnapshot(null);
    resetYsq();
    sa.resetSessionAlias(client);
    setDeleteError('');
    setClientTab('overview');
    setTabLoading(true);
    onOpenClient?.(clientId);
    switchView('client');
    // Ловим каждый источник отдельно (тест «не роняя остальные»); фолбэк [] неотличим от «данных нет» — копим упавшие, шлём одним отчётом.
    const failed: string[] = []; const [tasks, fetchedNotes, fetchedConcept, fetchedData, sn, mn, hist, diary] = await Promise.all([
      api.getTherapyTasksForClient(clientId).catch(() => { failed.push('задачи'); return []; }),
      api.getTherapistNotes(clientId).catch(() => { failed.push('заметки'); return null; }),
      api.getConceptualization(clientId).catch(() => { failed.push('концептуализация'); return null; }),
      api.getTherapyClientData(clientId).catch(() => { failed.push('данные клиента'); return null; }),
      api.getClientSchemaNotes(clientId).catch(() => { failed.push('карточки схем'); return []; }),
      api.getClientModeNotes(clientId).catch(() => { failed.push('карточки режимов'); return []; }),
      api.getTherapyClientHistory(clientId).catch(() => { failed.push('история'); return []; }),
      api.getClientDiary(clientId).catch(() => { failed.push('дневник'); return []; }),
    ]); if (failed.length) reportClientError({ message: `client detail partial load fail: ${failed.join(', ')}`, section: 'therapist.clientDetail' });

    if (!sameId(openClientIdRef.current, clientId)) return;

    setTabLoading(false);
    setClientTasks(tasks);
    if (fetchedNotes) notes.setNotesPage(fetchedNotes); else notes.resetNotesPage();
    conceptSave.loadConcept(fetchedConcept);
    setClientData(fetchedData);
    setClientSchemaNotesData(sn);
    setClientModeNotesData(mn);
    setClientHistory(hist);
    setClientDiary(diary);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────────
  function requestDeleteClient() {
    if (!selectedClient) return;
    setConfirmingDelete(true);
  }

  function cancelDeleteClient() { setConfirmingDelete(false); }

  async function deleteClient() {
    if (!selectedClient) return;
    setConfirmingDelete(false);
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.removeClient(selectedClient.telegramId);
      setClients(prev => prev.filter(c => !sameId(c.telegramId, selectedClient.telegramId)));
      // Удалённый — тот, что открыт: сбрасываем выбранного, иначе «Назад» в
      // браузере возвращал на /cabinet/<id> полную карточку удалённого (QA 2026-10-26).
      if (isOpen(selectedClient.telegramId)) { openClientIdRef.current = null; setSelectedClient(null); switchView('list'); }
    } catch { setDeleteError('Не удалось удалить клиента'); } finally { setDeleteLoading(false); }
  }

  // ── Задание назначено (TaskCreateSheet) — перечитать задания ЭТОГО клиента ──
  function onTaskAssigned() {
    setShowAssign(false);
    if (selectedClient) reloadClientTasks(selectedClient.telegramId, isOpen, api.getTherapyTasksForClient, setClientTasks);
  }

  // ── Export ─────────────────────────────────────────────────────────────────────
  function buildExportText(): string {
    if (!selectedClient || !concept) return '';
    const clientName = selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`;
    const date = concept.updatedAt ? fmtDate(momentDayKey(concept.updatedAt)) : todayStr();
    const c = { ...concept, ...localConcept };
    const schemaNames = activeSchemaIds.map(id => {
      const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
      return s ? s.name : id;
    });
    const modeNames = activeModeIds.map(id => {
      const m = MODE_GROUPS.flatMap(g => g.items).find(x => x.id === id);
      return m ? m.name : id;
    });
    const row = (label: string, value: string | null | undefined) => `${label}\n${value?.trim() || '–'}\n`;
    const div = '─'.repeat(44);
    const links = formatConceptLinksExport(activeSchemaIds, activeModeIds, c);
    return [
      `Клиент: ${clientName}   Дата: ${date}`,
      '', '══════ КРАТКАЯ КОНЦЕПТУАЛИЗАЦИЯ ══════', '',
      div, row('АКТУАЛЬНЫЕ СХЕМЫ (ЭДС)', schemaNames.join(' · ') || null),
      div, row('КАРТА РЕЖИМОВ', modeNames.join(' · ') || null),
      ...(links ? [div, `${links}\n`] : []),
      div, row('РАННИЙ ДИСФУНКЦИОНАЛЬНЫЙ ОПЫТ', c.earlyExperience as string),
      div, row('НЕУДОВЛЕТВОРЁННЫЕ БАЗОВЫЕ ПОТРЕБНОСТИ', c.unmetNeeds as string),
      div, row('СХЕМНЫЕ ТРИГГЕРЫ', c.triggers as string),
      div, row('ДЕЗАДАПТИВНЫЕ КОПИНГИ', c.copingStyles as string),
      div, row('АКТУАЛЬНЫЕ ПРОБЛЕМЫ И СИМПТОМЫ', c.currentProblems as string),
      div, row('ЦЕЛИ СХЕМА-ТЕРАПИИ', c.goals as string),
      div, '', '@SchemeHappens · Всё по схеме',
    ].join('\n');
  }

  async function handleExport() {
    const text = buildExportText();
    if (!text) return;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch { /* fallthrough */ }
    await copyExport(text);
  }

  return {
    openClientIdRef,
    // State
    selectedClient, setSelectedClient,
    clientSchemaNotesData, clientModeNotesData,
    clientTasks, setClientTasks,
    notes: notes.notesPage.notes, notesPage: notes.notesPage, noteError: notes.noteError,
    concept, clientData, clientHistory, clientDiary,
    localConcept, conceptError: conceptSave.conceptError, expandedSnapshot, setExpandedSnapshot,
    saveStatus: conceptSave.saveStatus, savedAt: conceptSave.savedAt, retrySave: conceptSave.retrySave,
    newNoteText: notes.newNoteText, setNewNoteText: notes.setNewNoteText,
    newNoteDate: notes.newNoteDate, setNewNoteDate: notes.setNewNoteDate,
    noteSaving: notes.noteSaving, showAssign, setShowAssign,
    editingStartDate: sa.editingStartDate, setEditingStartDate: sa.setEditingStartDate,
    localStartDate: sa.localStartDate, setLocalStartDate: sa.setLocalStartDate,
    editingNextSession: sa.editingNextSession, setEditingNextSession: sa.setEditingNextSession,
    localNextSession: sa.localNextSession, setLocalNextSession: sa.setLocalNextSession,
    sessionInfoSaving: sa.sessionInfoSaving, sessionInfoError: sa.sessionInfoError,
    renamingAlias: sa.renamingAlias, setRenamingAlias: sa.setRenamingAlias,
    aliasInput: sa.aliasInput, setAliasInput: sa.setAliasInput,
    aliasSaving: sa.aliasSaving, aliasError: sa.aliasError,
    ysqRequested, ysqError,
    exportCopied,
    deleteLoading, deleteError, confirmingDelete,
    tabLoading, clientTab, setClientTab,
    // Derived
    activeSchemaIds, activeModeIds, ysqSchemaIds, selfSchemaIds,
    // Handlers
    openClient, deleteClient, requestDeleteClient, cancelDeleteClient,
    addNote: notes.addNote, removeNote: notes.removeNote, onTaskAssigned,
    patchConcept: conceptSave.patchConcept, toggleSchemaId: conceptSave.toggleSchemaId, toggleModeId: conceptSave.toggleModeId,
    saveAlias: sa.saveAlias, saveSessionInfo: sa.saveSessionInfo,
    handleRequestYsq, handleExport,
  };
}
