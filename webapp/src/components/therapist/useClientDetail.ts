import { useRef, useState } from 'react';
import { api, reportClientError } from '../../api';
import type { TherapyClientSummary, UserTask, TherapistNote, ClientConceptualization, ClientData } from '../../api';
import { fmtDate, todayStr } from '../../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { useTr } from '../../utils/addressForm';

type ClientTab = 'overview' | 'concept' | 'mode_map' | 'sessions' | 'tasks' | 'ysq' | 'client_notes';

interface Params {
  onOpenClient?: (id: number) => void;
  switchView: (v: 'list' | 'client') => void;
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

export function useClientDetail({ onOpenClient, switchView, setClients }: Params) {
  const tr = useTr();
  const openClientIdRef = useRef<number | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Зеркало localConcept, обновляется СИНХРОННО (setLocalConceptSynced ниже).
  // Нужно autoSave: setTimeout(autoSave, 700) в patchConcept захватывает
  // autoSave текущего рендера, т.е. ДО коммита setState в следующем рендере —
  // раньше autoSave читал state и слал значение на один патч позади (баг).
  const localConceptRef = useRef<Partial<ClientConceptualization>>({});

  // Selected client + all its data
  const [selectedClient, setSelectedClient] = useState<TherapyClientSummary | null>(null);
  const [clientSchemaNotesData, setClientSchemaNotesData] = useState<Array<{
    schemaId: string; triggers: string; feelings: string; thoughts: string;
    origins: string; reality: string; healthyView: string; behavior: string;
  }>>([]);
  const [clientModeNotesData, setClientModeNotesData] = useState<Array<{
    modeId: string; triggers: string; feelings: string; thoughts: string;
    needs: string; behavior: string;
  }>>([]);
  const [clientTasks, setClientTasks] = useState<UserTask[]>([]);
  const [notes, setNotes] = useState<TherapistNote[]>([]);
  const [noteError, setNoteError] = useState('');
  const [concept, setConcept] = useState<ClientConceptualization | null>(null);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [clientHistory, setClientHistory] = useState<{ date: string; index: number | null; ratings: Record<string, number> }[]>([]);
  const [clientDiary, setClientDiary] = useState<{ type: 'schema' | 'mode' | 'gratitude'; date: string; schemaIds?: string[]; modeId?: string; excerpt: string }[]>([]);
  const [localConcept, setLocalConcept] = useState<Partial<ClientConceptualization>>({});
  // Пишет и в state (для рендера/деривативов), и синхронно в localConceptRef
  // (для autoSave) — см. комментарий у объявления localConceptRef выше.
  function setLocalConceptSynced(
    value: Partial<ClientConceptualization> | ((prev: Partial<ClientConceptualization>) => Partial<ClientConceptualization>),
  ) {
    setLocalConcept(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      localConceptRef.current = next;
      return next;
    });
  }
  const [conceptError, setConceptError] = useState('');
  const [expandedSnapshot, setExpandedSnapshot] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle');

  // Therapist notes composer
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteDate, setNewNoteDate] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  // Session info editing
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [localStartDate, setLocalStartDate] = useState('');
  const [editingNextSession, setEditingNextSession] = useState(false);
  const [localNextSession, setLocalNextSession] = useState('');
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
  const activeSchemaIds = (localConcept.schemaIds ?? concept?.schemaIds ?? []) as string[];
  const activeModeIds = (localConcept.modeIds ?? concept?.modeIds ?? []) as string[];
  const ysqSchemaIds = clientData?.ysqActiveSchemaIds ?? [];
  const selfSchemaIds = clientData?.mySchemaIds ?? [];

  // ── Open client ────────────────────────────────────────────────────────────────
  async function openClient(client: TherapyClientSummary) {
    const clientId = client.telegramId;
    openClientIdRef.current = clientId;

    setSelectedClient(client);
    setClientSchemaNotesData([]);
    setClientModeNotesData([]);
    setClientTasks([]);
    setNotes([]);
    setNoteError('');
    setConcept(null);
    setClientData(null);
    setClientHistory([]);
    setClientDiary([]);
    setLocalConceptSynced({});
    setConceptError('');
    setExpandedSnapshot(null);
    setYsqRequested(false);
    setYsqError('');
    setRenamingAlias(false);
    setAliasError('');
    setDeleteError('');
    setEditingStartDate(false);
    setEditingNextSession(false);
    setLocalNextSession(client.nextSession ?? '');
    setLocalStartDate(client.therapyStartDate ?? '');
    setClientTab('overview');
    setTabLoading(true);
    onOpenClient?.(clientId);
    switchView('client');
    // Ловим каждый источник отдельно (тест «не роняя остальные»); фолбэк [] неотличим от «данных нет» — копим упавшие, шлём одним отчётом.
    const failed: string[] = []; const [tasks, fetchedNotes, fetchedConcept, fetchedData, sn, mn, hist, diary] = await Promise.all([
      api.getTherapyTasksForClient(clientId).catch(() => { failed.push('задачи'); return []; }),
      api.getTherapistNotes(clientId).catch(() => { failed.push('заметки'); return []; }),
      api.getConceptualization(clientId).catch(() => { failed.push('концептуализация'); return null; }),
      api.getTherapyClientData(clientId).catch(() => { failed.push('данные клиента'); return null; }),
      api.getClientSchemaNotes(clientId).catch(() => { failed.push('карточки схем'); return []; }),
      api.getClientModeNotes(clientId).catch(() => { failed.push('карточки режимов'); return []; }),
      api.getTherapyClientHistory(clientId).catch(() => { failed.push('история'); return []; }),
      api.getClientDiary(clientId).catch(() => { failed.push('дневник'); return []; }),
    ]); if (failed.length) reportClientError({ message: `client detail partial load fail: ${failed.join(', ')}`, section: 'therapist.clientDetail' });

    if (openClientIdRef.current !== clientId) return;

    setTabLoading(false);
    setClientTasks(tasks);
    setNotes(fetchedNotes);
    setConcept(fetchedConcept);
    setClientData(fetchedData);
    setClientSchemaNotesData(sn);
    setClientModeNotesData(mn);
    setClientHistory(hist);
    setClientDiary(diary);
    if (fetchedConcept) setLocalConceptSynced(fetchedConcept);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────────
  function requestDeleteClient() {
    if (!selectedClient) return;
    setConfirmingDelete(true);
  }

  function cancelDeleteClient() {
    setConfirmingDelete(false);
  }

  async function deleteClient() {
    if (!selectedClient) return;
    setConfirmingDelete(false);
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.removeClient(selectedClient.telegramId);
      setClients(prev => prev.filter(c => c.telegramId !== selectedClient.telegramId));
      switchView('list');
    } catch { setDeleteError('Не удалось удалить клиента'); } finally { setDeleteLoading(false); }
  }

  // ── Therapist notes ────────────────────────────────────────────────────────────
  async function addNote() {
    if (!selectedClient || !newNoteText.trim()) return;
    setNoteSaving(true);
    setNoteError('');
    try {
      const date = newNoteDate || todayStr();
      const note = await api.createTherapistNote(selectedClient.telegramId, date, newNoteText.trim());
      setNotes(prev => [note, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      setNewNoteText('');
      setNewNoteDate('');
    } catch { setNoteError('Не удалось сохранить заметку'); } finally { setNoteSaving(false); }
  }

  async function removeNote(noteId: number) {
    try {
      await api.deleteTherapistNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch { setNoteError('Не удалось удалить заметку'); }
  }

  // ── Conceptualization ──────────────────────────────────────────────────────────
  function patchConcept(patch: Partial<ClientConceptualization>) {
    setLocalConceptSynced(prev => ({ ...prev, ...patch }));
    setSaveStatus('pending');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(autoSave, 700);
  }

  async function autoSave() {
    if (!selectedClient) return;
    setSaveStatus('saving');
    const c = localConceptRef.current; // не state — см. комментарий у localConceptRef
    try {
      const saved = await api.saveConceptualization(selectedClient.telegramId, {
        schemaIds: (c.schemaIds ?? []) as string[],
        modeIds: (c.modeIds ?? []) as string[],
        earlyExperience: (c.earlyExperience as string) ?? '',
        unmetNeeds: (c.unmetNeeds as string) ?? '',
        triggers: (c.triggers as string) ?? '',
        copingStyles: (c.copingStyles as string) ?? '',
        goals: (c.goals as string) ?? '',
        currentProblems: (c.currentProblems as string) ?? '',
        modeTransitions: (c.modeTransitions as string) ?? '',
      });
      setConcept(saved);
      setConceptError('');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('idle'); setConceptError(tr('Не удалось сохранить изменения. Попробуй ещё раз.', 'Не удалось сохранить изменения. Попробуйте ещё раз.')); } // БАГ (найден тестом): раньше не сообщал об ошибке
  }

  function toggleSchemaId(id: string) {
    const current = (localConcept.schemaIds ?? concept?.schemaIds ?? []) as string[];
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    patchConcept({ schemaIds: next });
  }

  function toggleModeId(id: string) {
    const current = (localConcept.modeIds ?? concept?.modeIds ?? []) as string[];
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    patchConcept({ modeIds: next });
  }

  // ── Alias ──────────────────────────────────────────────────────────────────────
  async function saveAlias() {
    if (!selectedClient) return;
    setAliasSaving(true);
    setAliasError('');
    try {
      await api.renameClient(selectedClient.telegramId, aliasInput);
      const updated = { ...selectedClient, clientAlias: aliasInput.trim() || null };
      setSelectedClient(updated);
      setClients(prev => prev.map(c => c.telegramId === selectedClient.telegramId ? updated : c));
      setRenamingAlias(false);
    } catch { setAliasError('Не удалось сохранить имя'); } finally { setAliasSaving(false); }
  }

  // ── Session info (catch раньше глушил ошибку — кнопка закрывала поле как будто сохранилось; теперь исход возвращается явно) ──
  async function saveSessionInfo(patch: { therapyStartDate?: string | null; nextSession?: string | null; meetingDays?: number[] }) {
    if (!selectedClient) return false;
    setSessionInfoSaving(true); setSessionInfoError('');
    try {
      await api.updateSessionInfo(selectedClient.telegramId, patch);
      const updated = { ...selectedClient, ...patch }; if (patch.meetingDays !== undefined) updated.meetingDays = patch.meetingDays;
      setSelectedClient(updated); setClients(prev => prev.map(c => c.telegramId === selectedClient.telegramId ? updated : c));
      return true;
    } catch { setSessionInfoError('Не удалось сохранить дату'); return false; } finally { setSessionInfoSaving(false); }
  }

  // ── YSQ ───────────────────────────────────────────────────────────────────────
  async function handleRequestYsq() {
    if (!selectedClient) return;
    setYsqError('');
    try {
      await api.requestYsq(selectedClient.telegramId);
      setYsqRequested(true);
      setTimeout(() => setYsqRequested(false), 3000);
    } catch { setYsqError('Не удалось отправить запрос'); }
  }

  // ── Export ─────────────────────────────────────────────────────────────────────
  function buildExportText(): string {
    if (!selectedClient || !concept) return '';
    const clientName = selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`;
    const date = concept.updatedAt ? fmtDate(concept.updatedAt.slice(0, 10)) : todayStr();
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
    return [
      `Клиент: ${clientName}   Дата: ${date}`,
      '', '══════ КРАТКАЯ КОНЦЕПТУАЛИЗАЦИЯ ══════', '',
      div, row('АКТУАЛЬНЫЕ СХЕМЫ (ЭДС)', schemaNames.join(' · ') || null),
      div, row('КАРТА РЕЖИМОВ', modeNames.join(' · ') || null),
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
    notes, noteError,
    concept, clientData, clientHistory, clientDiary,
    localConcept, conceptError, expandedSnapshot, setExpandedSnapshot,
    saveStatus,
    newNoteText, setNewNoteText, newNoteDate, setNewNoteDate,
    noteSaving, showAssign, setShowAssign,
    editingStartDate, setEditingStartDate,
    localStartDate, setLocalStartDate,
    editingNextSession, setEditingNextSession,
    localNextSession, setLocalNextSession,
    sessionInfoSaving, sessionInfoError,
    renamingAlias, setRenamingAlias,
    aliasInput, setAliasInput,
    aliasSaving, aliasError,
    ysqRequested, ysqError,
    exportCopied,
    deleteLoading, deleteError, confirmingDelete,
    tabLoading, clientTab, setClientTab,
    // Derived
    activeSchemaIds, activeModeIds, ysqSchemaIds, selfSchemaIds,
    // Handlers
    openClient, deleteClient, requestDeleteClient, cancelDeleteClient,
    addNote, removeNote,
    patchConcept, toggleSchemaId, toggleModeId,
    saveAlias, saveSessionInfo,
    handleRequestYsq, handleExport,
  };
}
