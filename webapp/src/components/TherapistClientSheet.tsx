import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { TherapyClientSummary, UserTask, TherapistNote, ClientConceptualization, ClientData } from '../api';
import { TaskCreateSheet } from './TaskCreateSheet';
import { fmtDate, todayStr } from '../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../schemaTherapyData';

interface Props {
  view: 'list' | 'client';
  openClientId?: number | null;
  onViewChange: (v: 'list' | 'client') => void;
  onOpenClient?: (id: number) => void;
  onClose: () => void;
  backHandlerRef?: React.MutableRefObject<() => void>;
}

type AddMode = null | 'invite' | 'telegram' | 'virtual';
type ClientTab = 'overview' | 'concept' | 'sessions' | 'tasks' | 'ysq' | 'client_notes';

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function calcTherapyDuration(startDateStr: string): string {
  const start = new Date(startDateStr);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) {
    const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
    if (days < 1) return 'сегодня';
    const m10 = days % 10, m100 = days % 100;
    const w = (m100 >= 11 && m100 <= 19) ? 'дней' : m10 === 1 ? 'день' : (m10 >= 2 && m10 <= 4) ? 'дня' : 'дней';
    return `${days} ${w}`;
  }
  const m10 = months % 10, m100 = months % 100;
  const w = (m100 >= 11 && m100 <= 19) ? 'месяцев' : m10 === 1 ? 'месяц' : (m10 >= 2 && m10 <= 4) ? 'месяца' : 'месяцев';
  return `${months} ${w}`;
}

function nextSessionLabel(dateStr: string): string {
  const [datePart, timePart] = dateStr.includes('T') ? dateStr.split('T') : [dateStr, null];
  const [, m, d] = datePart.split('-');
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const date = new Date(datePart + 'T00:00:00');
  const base = `${DAY_NAMES[date.getDay()]}, ${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`;
  return timePart ? `${base} · ${timePart}` : base;
}

function indexColor(v: number) {
  if (v >= 7) return '#06d6a0';
  if (v >= 4) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

const CONCEPT_FIELDS: { key: keyof ClientConceptualization; label: string; placeholder: string }[] = [
  { key: 'earlyExperience', label: 'Ранний дисфункциональный опыт', placeholder: 'Значимые события и паттерны из детства и юности, которые сформировали схемы...' },
  { key: 'unmetNeeds', label: 'Неудовлетворённые базовые потребности', placeholder: 'Привязанность, автономия, свобода выражения, игра/спонтанность, реалистичные границы...' },
  { key: 'triggers', label: 'Схемные триггеры', placeholder: 'Ситуации, слова, интонации, отношения — что запускает схемные реакции...' },
  { key: 'copingStyles', label: 'Стили совладания', placeholder: 'Капитуляция, избегание, гиперкомпенсация — типичные паттерны для каждой схемы...' },
  { key: 'modeTransitions', label: 'Переключение режимов', placeholder: 'Что запускает переход в уязвимого ребёнка? Как активируется карающий критик? Когда появляется здоровый взрослый?...' },
  { key: 'currentProblems', label: 'Актуальные проблемы и симптомы', placeholder: 'С чем обратился клиент, текущие жалобы, симптоматика...' },
];

function RosterSparkline({ values }: { values: (number | null)[] }) {
  const W = 96, H = 30, N = 14;
  const pts = values.slice(-N);
  const nums = pts.filter(v => v != null) as number[];
  if (nums.length === 0) return <svg width={W} height={H} />;
  const min = Math.min(...nums), max = Math.max(...nums);
  const range = max - min || 1;
  const step = W / Math.max(N - 1, 1);
  const x = (i: number) => i * step;
  const y = (v: number) => H - 4 - ((v - min) / range) * (H - 8);
  const d = pts.map((v, i) => v == null ? null : `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(' ');
  const dots = pts.map((v, i) => v == null ? null : { cx: x(i), cy: y(v) });
  return (
    <svg width={W} height={H} className="spark">
      {d && <path d={d} fill="none" stroke="var(--text-ghost)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
      {dots.map((p, i) => p && <circle key={i} cx={p.cx} cy={p.cy} r={2} fill="var(--text-faint)" />)}
    </svg>
  );
}

export function TherapistClientSheet({ view, openClientId: openClientIdProp, onViewChange, onOpenClient, onClose: _onClose, backHandlerRef }: Props) {
  // Client list
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTab, setListTab] = useState<'clients' | 'kanban'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [allTasks, setAllTasks] = useState<{ clientId: number; clientName: string; tasks: UserTask[] }[] | null>(null);
  const [allTasksLoading, setAllTasksLoading] = useState(false);

  // Add client flow
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const inviteInputRef = useRef<HTMLInputElement>(null);

  // Delete client
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Client detail
  const [selectedClient, setSelectedClient] = useState<TherapyClientSummary | null>(null);
  const [clientSchemaNotesData, setClientSchemaNotesData] = useState<Array<{ schemaId: string; triggers: string; feelings: string; thoughts: string; origins: string; reality: string; healthyView: string; behavior: string }>>([]);
  const [clientModeNotesData, setClientModeNotesData] = useState<Array<{ modeId: string; triggers: string; feelings: string; thoughts: string; needs: string; behavior: string }>>([]);
  const [clientTasks, setClientTasks] = useState<UserTask[]>([]);
  const [notes, setNotes] = useState<TherapistNote[]>([]);
  const [noteError, setNoteError] = useState('');
  const [concept, setConcept] = useState<ClientConceptualization | null>(null);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [clientHistory, setClientHistory] = useState<{ date: string; index: number | null; ratings: Record<string, number> }[]>([]);
  const [clientDiary, setClientDiary] = useState<{ type: 'schema' | 'mode' | 'gratitude'; date: string; schemaIds?: string[]; modeId?: string; excerpt: string }[]>([]);
  const [localConcept, setLocalConcept] = useState<Partial<ClientConceptualization>>({});
  const [conceptDirty, setConceptDirty] = useState(false);
  const [conceptSaving, setConceptSaving] = useState(false);
  const [conceptError, setConceptError] = useState('');
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

  // Rename alias
  const [renamingAlias, setRenamingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasError, setAliasError] = useState('');

  // YSQ request
  const [ysqRequested, setYsqRequested] = useState(false);
  const [ysqError, setYsqError] = useState('');

  // Export
  const [exportCopied, setExportCopied] = useState(false);

  // Animation key — changes when view transitions to trigger CSS animation
  const [animKey, setAnimKey] = useState(0);

  // Client detail tab
  const [clientTab, setClientTab] = useState<ClientTab>('overview');

  // Race condition guard: ignore stale state updates when client changes quickly
  const openClientIdRef = useRef<number | null>(null);

  useEffect(() => {
    api.getTherapyClients().then(cl => {
      setClients(cl);
      if (openClientIdProp) {
        const c = cl.find(x => x.telegramId === openClientIdProp);
        if (c) openClient(c);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchView(v: 'list' | 'client') {
    setAnimKey(k => k + 1);
    onViewChange(v);
  }

  // ─── Back button handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!backHandlerRef || view !== 'client') return;
    backHandlerRef.current = () => {
      if (showAssign) { setShowAssign(false); return; }
      switchView('list');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, showAssign, backHandlerRef]);

  // ─── Open client ──────────────────────────────────────────────────────────────

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
    setLocalConcept({});
    setConceptDirty(false);
    setConceptError('');
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
    // Triggers URL change (/cabinet/:id) which makes AppShell render view='client'
    onOpenClient?.(clientId);
    switchView('client');

    const [tasks, fetchedNotes, fetchedConcept, fetchedData, sn, mn, hist, diary] = await Promise.all([
      api.getTherapyTasksForClient(clientId).catch(() => []),
      api.getTherapistNotes(clientId).catch(() => []),
      api.getConceptualization(clientId).catch(() => null),
      api.getTherapyClientData(clientId).catch(() => null),
      api.getClientSchemaNotes(clientId).catch(() => []),
      api.getClientModeNotes(clientId).catch(() => []),
      api.getTherapyClientHistory(clientId).catch(() => []),
      api.getClientDiary(clientId).catch(() => []),
    ]);

    if (openClientIdRef.current !== clientId) return;

    setClientTasks(tasks);
    setNotes(fetchedNotes);
    setConcept(fetchedConcept);
    setClientData(fetchedData);
    setClientSchemaNotesData(sn);
    setClientModeNotesData(mn);
    setClientHistory(hist);
    setClientDiary(diary);
    if (fetchedConcept) setLocalConcept(fetchedConcept);
  }

  // ─── Delete client ────────────────────────────────────────────────────────────

  async function deleteClient() {
    if (!selectedClient) return;
    const name = selectedClient.clientAlias ?? selectedClient.name ?? 'этого клиента';
    if (!window.confirm(`Удалить ${name}? Связь будет разорвана, данные сохранятся.`)) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.removeClient(selectedClient.telegramId);
      setClients(prev => prev.filter(c => c.telegramId !== selectedClient.telegramId));
      switchView('list');
    } catch { setDeleteError('Не удалось удалить клиента'); } finally { setDeleteLoading(false); }
  }

  // ─── Add client flows ─────────────────────────────────────────────────────────

  function openAddMode(mode: AddMode) {
    setAddMode(mode);
    setAddInput('');
    setAddError('');
    setInviteUrl('');
    setInviteCopied(false);
  }

  async function createInvite() {
    setInviteLoading(true);
    try {
      const { url } = await api.createTherapyInvite();
      setInviteUrl(url);
    } catch (e: any) { setAddError(e?.message ?? 'Не удалось создать ссылку'); } finally { setInviteLoading(false); }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch { inviteInputRef.current?.select(); }
  }

  function shareInvite() {
    if (!inviteUrl) return;
    if (navigator.share) {
      navigator.share({ text: 'Подключись ко мне в Схема-лабе:', url: inviteUrl }).catch(() => {});
    } else {
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('Подключись ко мне в Схема-лабе')}`;
      window.open(tgUrl, '_blank', 'noopener');
    }
  }

  async function addByTelegramId() {
    const id = parseInt(addInput.trim(), 10);
    if (!id || isNaN(id)) { setAddError('Введи числовой Telegram ID'); return; }
    setAddLoading(true);
    setAddError('');
    try {
      const updated = await api.addClientManually(id);
      setClients(updated);
      openAddMode(null);
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.toLowerCase().includes('not found')) setAddError('Пользователь не найден. Должен открыть приложение хотя бы раз.');
      else if (msg.toLowerCase().includes('already')) setAddError('Клиент уже подключён');
      else setAddError('Ошибка. Проверь ID.');
    } finally { setAddLoading(false); }
  }

  async function addVirtualClient() {
    const name = addInput.trim();
    if (!name) { setAddError('Введи имя клиента'); return; }
    setAddLoading(true);
    setAddError('');
    try {
      const updated = await api.addVirtualClient(name);
      setClients(updated);
      openAddMode(null);
    } catch { setAddError('Ошибка. Попробуй ещё раз.'); } finally { setAddLoading(false); }
  }

  // ─── Notes ────────────────────────────────────────────────────────────────────

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

  // ─── Conceptualization ────────────────────────────────────────────────────────

  function patchConcept(patch: Partial<ClientConceptualization>) {
    setLocalConcept(prev => ({ ...prev, ...patch }));
    setConceptDirty(true);
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

  async function saveConcept() {
    if (!selectedClient || !conceptDirty) return;
    setConceptSaving(true);
    setConceptError('');
    try {
      const saved = await api.saveConceptualization(selectedClient.telegramId, {
        schemaIds: (localConcept.schemaIds ?? []) as string[],
        modeIds: (localConcept.modeIds ?? []) as string[],
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
    } catch (e: any) {
      setConceptError(e?.message?.startsWith('API') ? 'Ошибка сервера. Попробуй позже.' : (e?.message ?? 'Ошибка сохранения'));
    } finally { setConceptSaving(false); }
  }

  // ─── Alias ────────────────────────────────────────────────────────────────────

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

  async function saveSessionInfo(patch: { therapyStartDate?: string | null; nextSession?: string | null; meetingDays?: number[] }) {
    if (!selectedClient) return;
    setSessionInfoSaving(true);
    try {
      await api.updateSessionInfo(selectedClient.telegramId, patch);
      const updated = { ...selectedClient, ...patch };
      if (patch.meetingDays !== undefined) updated.meetingDays = patch.meetingDays;
      setSelectedClient(updated);
      setClients(prev => prev.map(c => c.telegramId === selectedClient.telegramId ? updated : c));
    } catch { /* ignore */ } finally { setSessionInfoSaving(false); }
  }

  async function handleRequestYsq() {
    if (!selectedClient) return;
    setYsqError('');
    try {
      await api.requestYsq(selectedClient.telegramId);
      setYsqRequested(true);
      setTimeout(() => setYsqRequested(false), 3000);
    } catch { setYsqError('Не удалось отправить запрос'); }
  }

  // ─── Export ───────────────────────────────────────────────────────────────────

  function buildExportText(): string {
    if (!selectedClient || !concept) return '';
    const clientName = selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`;
    const date = concept.updatedAt ? fmtDate(concept.updatedAt.slice(0, 10)) : todayStr();
    const c = { ...concept, ...localConcept };
    const schemaNames = activeSchemaIds.map(id => {
      const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
      return s ? `${s.emoji} ${s.name}` : id;
    });
    const modeNames = activeModeIds.map(id => {
      const m = MODE_GROUPS.flatMap(g => g.items).find(x => x.id === id);
      return m ? `${m.emoji} ${m.name}` : id;
    });
    const row = (label: string, value: string | null | undefined) => `${label}\n${value?.trim() || '—'}\n`;
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
      div, '', '@SchemeHappens · Схема-лаб',
    ].join('\n');
  }

  async function handleExport() {
    const text = buildExportText();
    if (!text) return;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch { /* fallthrough */ }
    try {
      await navigator.clipboard.writeText(text);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2500);
    } catch { /* ignore */ }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const activeSchemaIds = (localConcept.schemaIds ?? concept?.schemaIds ?? []) as string[];
  const activeModeIds = (localConcept.modeIds ?? concept?.modeIds ?? []) as string[];
  const ysqSchemaIds = clientData?.ysqActiveSchemaIds ?? [];
  const selfSchemaIds = clientData?.mySchemaIds ?? [];

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── LIST VIEW ──────────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div key={`list-${animKey}`} style={{ animation: 'fade-in 0.22s ease', flex: 1, overflow: 'auto' }}>
          <div className="page-inner-wide">

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em' }}>Кабинет</div>
                  <span className="chip chip-accent" style={{ fontSize: 10 }}>психолог</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6 }}>
                  {clients.length} клиентов · Задания · Концептуализация
                </div>
              </div>
              <button
                onClick={() => openAddMode(addMode ? null : 'invite')}
                className={addMode ? 'btn btn-secondary' : 'btn btn-primary'}
              >
                {addMode ? '✕ Закрыть' : '+ Добавить клиента'}
              </button>
            </div>

            {/* Tabs + search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <div className="tabs" style={{ marginBottom: 0 }}>
                <button
                  className={`tab ${listTab === 'clients' ? 'is-active' : ''}`}
                  onClick={() => setListTab('clients')}
                >
                  Клиенты
                  {clients.length > 0 && <span className="count">{clients.length}</span>}
                </button>
                <button
                  className={`tab ${listTab === 'kanban' ? 'is-active' : ''}`}
                  onClick={() => {
                    setListTab('kanban');
                    if (!allTasks && !allTasksLoading) {
                      setAllTasksLoading(true);
                      api.getAllTherapyTasks().then(setAllTasks).catch(() => setAllTasks([])).finally(() => setAllTasksLoading(false));
                    }
                  }}
                >
                  Задания
                </button>
              </div>
              {listTab === 'clients' && (
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск клиента..."
                  className="input"
                  style={{ flex: 1, maxWidth: 320 }}
                />
              )}
            </div>

            {/* Add client panel */}
            {addMode && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '24px', marginBottom: 36 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {(['invite', 'telegram', 'virtual'] as const).map(m => (
                    <button key={m} onClick={() => openAddMode(m)} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${addMode === m ? 'var(--accent)' : 'var(--line)'}`, background: addMode === m ? 'var(--accent-soft)' : 'transparent', color: addMode === m ? 'var(--accent)' : 'var(--text-faint)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
                      {{ invite: '🔗 Пригласить', telegram: '🔢 Telegram ID', virtual: '👤 Оффлайн' }[m]}
                    </button>
                  ))}
                </div>

                {addMode === 'invite' && (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>Отправь клиенту ссылку — он перейдёт и автоматически подключится.</div>
                    {!inviteUrl ? (
                      <button onClick={createInvite} disabled={inviteLoading} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        {inviteLoading ? 'Создаю...' : 'Создать ссылку'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input ref={inviteInputRef} readOnly value={inviteUrl} style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 12, color: 'var(--text-sub)', fontFamily: 'monospace' }} />
                        <button onClick={copyInvite} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: inviteCopied ? 'var(--c-moss)' : 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                          {inviteCopied ? '✓ Скопировано' : 'Скопировать'}
                        </button>
                        <button onClick={shareInvite} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Поделиться</button>
                      </div>
                    )}
                  </div>
                )}

                {addMode === 'telegram' && (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>Числовой Telegram ID клиента (узнать у клиента или через @userinfobot)</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" value={addInput} onChange={e => setAddInput(e.target.value)} placeholder="123456789" style={{ width: 180, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13 }} />
                      <button onClick={addByTelegramId} disabled={addLoading} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        {addLoading ? '...' : 'Добавить'}
                      </button>
                    </div>
                  </div>
                )}

                {addMode === 'virtual' && (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>Для клиентов без Telegram — концептуализация и заметки без привязки к боту</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={addInput} onChange={e => setAddInput(e.target.value)} placeholder="Имя клиента" style={{ width: 240, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13 }} />
                      <button onClick={addVirtualClient} disabled={addLoading} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        {addLoading ? '...' : 'Создать'}
                      </button>
                    </div>
                  </div>
                )}

                {addError && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--c-rose)' }}>{addError}</div>}
              </div>
            )}

            {/* Today dashboard — только если есть РЕАЛЬНЫЕ сегодняшние данные */}
            {!loading && clients.length > 0 && (() => {
              const today = todayStr();
              const sessionsToday = clients
                .filter(c => c.nextSession && c.nextSession.slice(0, 10) === today)
                .sort((a, b) => (a.nextSession ?? '').localeCompare(b.nextSession ?? ''));
              const activeToday = clients.filter(c => c.lastActiveDate === today);

              if (sessionsToday.length === 0 && activeToday.length === 0) return null;
              return (
                <div style={{ marginBottom: 40 }}>
                  {sessionsToday.length > 0 && (
                    <div className="section">
                      <div className="section-head">
                        <h3>Сессии сегодня</h3>
                        <span className="hint">{sessionsToday.length} {sessionsToday.length === 1 ? 'встреча' : sessionsToday.length < 5 ? 'встречи' : 'встреч'}</span>
                      </div>
                      {sessionsToday.map(client => {
                        const [, timePart] = (client.nextSession ?? '').includes('T') ? (client.nextSession ?? '').split('T') : ['', null];
                        const name = client.clientAlias ?? client.name ?? `ID ${client.telegramId}`;
                        return (
                          <div key={client.telegramId} className="list-line" onClick={() => openClient(client)} style={{ cursor: 'pointer' }}>
                            <span className="num text-md" style={{ width: 52, flexShrink: 0, color: 'var(--text-sub)', fontWeight: 500 }}>{timePart ?? '—'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="text-md" style={{ fontWeight: 600 }}>{name}</div>
                              {client.streak > 0 && <div className="text-xs muted" style={{ marginTop: 3 }}>{client.streak} дн. подряд</div>}
                            </div>
                            <span className="link">открыть →</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {activeToday.length > 0 && (
                    <div className="section">
                      <div className="section-head">
                        <h3>Активны сегодня</h3>
                        <span className="hint">{activeToday.length} из {clients.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {activeToday.map(client => (
                          <button
                            key={client.telegramId}
                            onClick={() => openClient(client)}
                            style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-moss)', flexShrink: 0 }} />
                            {client.clientAlias ?? client.name ?? `ID ${client.telegramId}`}
                            {client.todayIndex !== null && (
                              <span className="num text-xs" style={{ color: indexColor(client.todayIndex) }}>{client.todayIndex.toFixed(1)}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Kanban view ── */}
            {listTab === 'kanban' && (
              <KanbanView
                allTasks={allTasks}
                loading={allTasksLoading}
                onOpenClient={(clientId) => {
                  const client = clients.find(c => c.telegramId === clientId);
                  if (client) openClient(client);
                }}
              />
            )}

            {/* Client roster — адаптивно для оффлайн/онлайн */}
            {listTab === 'clients' && (
              loading ? (
                <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-faint)' }}>Загрузка...</div>
              ) : clients.length === 0 ? (
                <div className="section" style={{ borderTop: '1px solid var(--line)', paddingTop: 32 }}>
                  <h3 style={{ marginBottom: 8 }}>Добавь первого клиента</h3>
                  <div className="text-md muted" style={{ maxWidth: 560, lineHeight: 1.6, marginBottom: 20 }}>
                    Через кнопку «+ Добавить клиента» вверху. Три варианта:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 600 }}>
                    <div className="list-line"><div style={{ flex: 1 }}><div className="text-md" style={{ fontWeight: 500 }}>Ссылка</div><div className="text-sm muted" style={{ marginTop: 3 }}>клиент подключается через Telegram-бот по приглашению</div></div></div>
                    <div className="list-line"><div style={{ flex: 1 }}><div className="text-md" style={{ fontWeight: 500 }}>Telegram ID</div><div className="text-sm muted" style={{ marginTop: 3 }}>если знаешь его ID — добавишь сразу</div></div></div>
                    <div className="list-line"><div style={{ flex: 1 }}><div className="text-md" style={{ fontWeight: 500 }}>Оффлайн</div><div className="text-sm muted" style={{ marginTop: 3 }}>клиент без Telegram — заметки и концептуализация без бота</div></div></div>
                  </div>
                </div>
              ) : (() => {
                const q = searchQuery.toLowerCase().trim();
                const filtered = q
                  ? clients.filter(c => (c.clientAlias ?? c.name ?? '').toLowerCase().includes(q))
                  : clients;
                const onlineClients = filtered.filter(c => !!c.name);
                const offlineClients = filtered.filter(c => !c.name);
                const hasOnline = onlineClients.length > 0;
                return (
                  <div>
                    {q && filtered.length === 0 && (
                      <div className="text-md muted" style={{ padding: '24px 0' }}>Ничего не найдено</div>
                    )}
                    {hasOnline && (
                      <div className="section">
                        <div className="section-head">
                          <h3>Клиенты с приложением</h3>
                          <span className="hint">{onlineClients.length}</span>
                        </div>
                        <div className="r-row-head">
                          <span className="eyebrow">Клиент</span>
                          <span className="eyebrow">Индекс</span>
                          <span className="eyebrow">14 дн.</span>
                          <span className="eyebrow">Активные схемы</span>
                        </div>
                        {onlineClients.map(client => (
                          <div key={client.telegramId} className="r-row row-hover" onClick={() => openClient(client)} style={{ cursor: 'pointer' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="text-base" style={{ fontWeight: 600 }}>{client.clientAlias ?? client.name ?? `ID ${client.telegramId}`}</span>
                                {client.lastActiveDate === todayStr() && (
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-moss)', flexShrink: 0 }} />
                                )}
                              </div>
                              <div className="text-xs faint" style={{ marginTop: 3 }}>
                                {client.therapyStartDate ? `с ${fmtDate(client.therapyStartDate)}` : 'начало не задано'}
                                {client.streak > 0 && ` · стрик ${client.streak} дн.`}
                              </div>
                            </div>
                            <div>
                              {client.todayIndex != null ? (
                                <span className="num" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: indexColor(client.todayIndex) }}>{client.todayIndex.toFixed(1)}</span>
                              ) : <span className="text-sm faint">—</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <RosterSparkline values={(client.recentIndexHistory ?? []).slice().reverse()} />
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center' }}>
                              {client.schemaIds.length > 0 ? client.schemaIds.slice(0, 3).map(id => {
                                const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === id));
                                const schema = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.id === id);
                                return (
                                  <span key={id} className="tag-mini">
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: domain?.color ?? 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
                                    {schema?.name ?? id}
                                  </span>
                                );
                              }) : <span className="text-xs faint">—</span>}
                              {client.schemaIds.length > 3 && <span className="text-xs faint">+{client.schemaIds.length - 3}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {offlineClients.length > 0 && (
                      <div className="section">
                        <div className="section-head">
                          <h3>Оффлайн-клиенты</h3>
                          <span className="hint">{offlineClients.length} · заметки и концептуализация</span>
                        </div>
                        {offlineClients.map(client => {
                          const name = client.clientAlias ?? `ID ${client.telegramId}`;
                          return (
                            <div key={client.telegramId} className="list-line" onClick={() => openClient(client)} style={{ cursor: 'pointer' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="text-md" style={{ fontWeight: 600 }}>{name}</div>
                                <div className="text-sm muted" style={{ marginTop: 3 }}>
                                  {client.therapyStartDate ? `Начало терапии · ${fmtDate(client.therapyStartDate)}` : 'без Telegram'}
                                  {client.nextSession && ` · след. встреча ${nextSessionLabel(client.nextSession)}`}
                                </div>
                              </div>
                              <span className="link">открыть →</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ── CLIENT VIEW ────────────────────────────────────────────────────────── */}
      {view === 'client' && selectedClient && (
        <div key={`client-${animKey}`} style={{ animation: 'fade-in 0.22s ease', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Client header */}
          <div style={{ borderBottom: '1px solid var(--line)', padding: '24px 48px 0', flexShrink: 0 }}>
            <button onClick={() => switchView('list')} style={{ background: 'none', border: 'none', padding: '0 0 14px', fontSize: 13, color: 'var(--text-faint)', cursor: 'pointer' }}>
              ← Все клиенты
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingAlias ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      autoFocus
                      value={aliasInput}
                      onChange={e => setAliasInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveAlias(); if (e.key === 'Escape') setRenamingAlias(false); }}
                      style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', width: 280, padding: '2px 0', color: 'var(--text)' }}
                    />
                    <button onClick={saveAlias} disabled={aliasSaving} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 12, cursor: 'pointer' }}>
                      {aliasSaving ? '...' : 'Сохранить'}
                    </button>
                    <button onClick={() => setRenamingAlias(false)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    {aliasError && <span style={{ fontSize: 12, color: 'var(--c-rose)' }}>{aliasError}</span>}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0 }}>
                      {selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`}
                    </h1>
                    {!selectedClient.name && <span className="chip chip-line" style={{ fontSize: 11 }}>оффлайн</span>}
                    <button
                      onClick={() => { setRenamingAlias(true); setAliasInput(selectedClient.clientAlias ?? selectedClient.name ?? ''); }}
                      style={{ background: 'none', border: 'none', padding: '2px 6px', borderRadius: 4, color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer' }}
                      title="Переименовать"
                    >✎</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  {selectedClient.therapyStartDate && (
                    <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                      С {fmtDate(selectedClient.therapyStartDate)} · {calcTherapyDuration(selectedClient.therapyStartDate)}
                    </span>
                  )}
                  {selectedClient.nextSession && (
                    <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                      следующая {nextSessionLabel(selectedClient.nextSession)}
                    </span>
                  )}
                  {selectedClient.todayIndex != null && (
                    <span style={{ fontSize: 13, fontWeight: 500, color: indexColor(selectedClient.todayIndex) }}>
                      Индекс {selectedClient.todayIndex.toFixed(1)}
                    </span>
                  )}
                  {selectedClient.streak > 0 && (
                    <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{selectedClient.streak} дн. подряд</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 24 }}>
                <button onClick={() => setShowAssign(true)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  + Задание
                </button>
                <button onClick={() => setClientTab('sessions')} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  + Заметка
                </button>
                <button onClick={deleteClient} disabled={deleteLoading} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, color: 'var(--c-rose)', cursor: 'pointer' }}>
                  {deleteLoading ? '...' : 'Удалить'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {([
                ['overview', 'Обзор', null],
                ['concept', 'Концептуализация', null],
                ['sessions', 'Сессии', notes.length],
                ['tasks', 'Задания', clientTasks.length],
                ['ysq', 'YSQ', clientData?.ysqHistory?.length ?? 0],
                ['client_notes', 'Записи клиента', clientSchemaNotesData.length + clientModeNotesData.length + clientDiary.length],
              ] as [ClientTab, string, number | null][]).map(([t, label, count]) => (
                <button key={t} className={`tab${clientTab === t ? ' is-active' : ''}`} onClick={() => setClientTab(t)}>
                  {label}
                  {count != null && count > 0 && (
                    <span style={{ marginLeft: 6, background: 'var(--surface-3)', borderRadius: 10, padding: '1px 6px', fontSize: 10.5, fontWeight: 500 }}>{count}</span>
                  )}
                </button>
              ))}
            </div>

            {deleteError && <div style={{ padding: '8px 0', fontSize: 13, color: 'var(--c-rose)' }}>{deleteError}</div>}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto' }} key={clientTab}>

            {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
            {clientTab === 'overview' && (
              <div className="page-inner-wide" style={{ paddingTop: 40 }}>
                <div className="doc-grid">
                  <div>
                    {/* Therapy goals — shown as a quiet quote */}
                    {(localConcept.goals || concept?.goals) && (
                      <div className="section">
                        <div className="eyebrow" style={{ marginBottom: 14 }}>Цель терапии</div>
                        <div style={{ fontSize: 22, lineHeight: 1.45, color: 'var(--text)', letterSpacing: '-0.02em', maxWidth: 720, fontWeight: 400 }}>
                          {(localConcept.goals || concept?.goals) as string}
                        </div>
                        <button className="link" style={{ marginTop: 16, fontSize: 13, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setClientTab('concept')}>
                          Открыть концептуализацию →
                        </button>
                      </div>
                    )}

                    {/* Active schemas by domain */}
                    {activeSchemaIds.length > 0 && (
                      <div className="section">
                        <div className="section-head" style={{ marginBottom: 20 }}>
                          <h3>Активные схемы</h3>
                          <span className="hint">{activeSchemaIds.length} в работе</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                          {SCHEMA_DOMAINS.map(domain => {
                            const active = domain.schemas.filter(s => activeSchemaIds.includes(s.id));
                            if (active.length === 0) return null;
                            return (
                              <div key={domain.id}>
                                <div className="eyebrow" style={{ color: domain.color, marginBottom: 8 }}>{domain.domain}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 24, rowGap: 6 }}>
                                  {active.map(s => (
                                    <div key={s.id} className="tag-mini">
                                      <span className="swatch" style={{ background: domain.color }} />
                                      {s.name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mode map */}
                    {activeModeIds.length > 0 && (
                      <div className="section">
                        <div className="section-head" style={{ marginBottom: 20 }}>
                          <h3>Карта режимов</h3>
                          <span className="hint">{activeModeIds.length} в работе</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
                          {MODE_GROUPS.map(group => {
                            const active = group.items.filter(m => activeModeIds.includes(m.id));
                            return (
                              <div key={group.id}>
                                <div className="eyebrow" style={{ color: group.color, marginBottom: 10 }}>{group.group}</div>
                                {active.length === 0 ? (
                                  <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>—</div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {active.map(m => (
                                      <div key={m.id} style={{ fontSize: 13, color: 'var(--text)' }}>{m.name}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Last session note */}
                    {notes.length > 0 && (
                      <div className="section">
                        <div className="section-head" style={{ marginBottom: 16 }}>
                          <h3>Заметка сессии</h3>
                          <button className="link" style={{ fontSize: 13, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setClientTab('sessions')}>Все заметки →</button>
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-sub)', maxWidth: 720 }}>{notes[0].text}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>{fmtDate(notes[0].date)}</div>
                      </div>
                    )}

                    {/* Client diary entries preview */}
                    {clientDiary.length > 0 && (
                      <div className="section">
                        <div className="section-head" style={{ marginBottom: 16 }}>
                          <h3>Последние записи клиента</h3>
                          <button className="link" style={{ fontSize: 13, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => setClientTab('client_notes')}>Все записи →</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {clientDiary.slice(0, 5).map((entry, i) => {
                            let color = 'var(--text-faint)';
                            let title = '';
                            let typeLabel = '';
                            if (entry.type === 'schema') {
                              const firstId = entry.schemaIds?.[0];
                              const domain = firstId ? SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === firstId)) : null;
                              const schema = firstId ? SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.id === firstId) : null;
                              color = domain?.color ?? 'var(--accent)';
                              title = schema ? `${schema.emoji} ${schema.name}` : (entry.schemaIds?.join(', ') ?? 'Схема');
                              const extra = (entry.schemaIds?.length ?? 0) > 1 ? ` +${(entry.schemaIds?.length ?? 1) - 1}` : '';
                              title += extra;
                              typeLabel = 'Схема-дневник';
                            } else if (entry.type === 'mode') {
                              const mode = getModeById(entry.modeId ?? '');
                              const group = mode ? MODE_GROUPS.find(g => g.items.some(m => m.id === entry.modeId)) : null;
                              color = group?.color ?? 'var(--accent-violet)';
                              title = mode ? `${mode.emoji} ${mode.name}` : (entry.modeId ?? 'Режим');
                              typeLabel = 'Режим-дневник';
                            } else {
                              color = '#06d6a0';
                              title = 'Благодарность';
                              typeLabel = 'Дневник благодарности';
                            }
                            return (
                              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', borderLeft: `3px solid ${color}` }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{typeLabel}</span>
                                  </div>
                                  {entry.excerpt && (
                                    <div style={{ fontSize: 12, color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                                      {entry.excerpt}
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtDate(entry.date)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {activeSchemaIds.length === 0 && activeModeIds.length === 0 && notes.length === 0 && (
                      <div className="section">
                        <div style={{ padding: '32px 0', color: 'var(--text-faint)', fontSize: 14 }}>
                          Заполни концептуализацию, чтобы увидеть схемы и режимы клиента
                        </div>
                        <button onClick={() => setClientTab('concept')} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                          Открыть концептуализацию
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right sidebar */}
                  <aside>
                    {/* Next session */}
                    <div className="section">
                      <div className="eyebrow" style={{ marginBottom: 14 }}>Следующая сессия</div>
                      {editingNextSession ? (
                        <div>
                          <input
                            type="datetime-local"
                            value={localNextSession}
                            onChange={e => setLocalNextSession(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13 }}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button onClick={async () => { await saveSessionInfo({ nextSession: localNextSession || null }); setEditingNextSession(false); }} disabled={sessionInfoSaving} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 12, cursor: 'pointer' }}>
                              {sessionInfoSaving ? '...' : 'Сохранить'}
                            </button>
                            <button onClick={() => setEditingNextSession(false)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {selectedClient.nextSession ? (
                            <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }}>
                              {nextSessionLabel(selectedClient.nextSession)}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Не установлена</div>
                          )}
                          {selectedClient.meetingDays && selectedClient.meetingDays.length > 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 4 }}>
                              {selectedClient.meetingDays.map(d => DAY_NAMES[d]).join(', ')} еженедельно
                            </div>
                          )}
                          <button onClick={() => { setEditingNextSession(true); setLocalNextSession(selectedClient.nextSession ?? ''); }} style={{ background: 'none', border: 'none', padding: '8px 0 0', fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>
                            Изменить →
                          </button>
                        </div>
                      )}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />

                    {/* Start date */}
                    <div className="section">
                      <div className="eyebrow" style={{ marginBottom: 10 }}>Начало терапии</div>
                      {editingStartDate ? (
                        <div>
                          <input
                            type="date"
                            value={localStartDate}
                            onChange={e => setLocalStartDate(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13 }}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button onClick={async () => { await saveSessionInfo({ therapyStartDate: localStartDate || null }); setEditingStartDate(false); }} disabled={sessionInfoSaving} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 12, cursor: 'pointer' }}>
                              {sessionInfoSaving ? '...' : 'Сохранить'}
                            </button>
                            <button onClick={() => setEditingStartDate(false)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 12, cursor: 'pointer' }}>Отмена</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, color: 'var(--text)' }}>
                            {selectedClient.therapyStartDate ? fmtDate(selectedClient.therapyStartDate) : <span style={{ color: 'var(--text-faint)' }}>Не указана</span>}
                          </span>
                          <button onClick={() => { setEditingStartDate(true); setLocalStartDate(selectedClient.therapyStartDate ?? ''); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>
                            изменить
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Wellbeing index + sparkline */}
                    {selectedClient.todayIndex != null && (
                      <>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
                        <div className="section">
                          <div className="eyebrow" style={{ marginBottom: 12 }}>Индекс сегодня</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: 52, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, color: indexColor(selectedClient.todayIndex) }}>
                              {selectedClient.todayIndex.toFixed(1)}
                            </div>
                            {clientHistory.length >= 7 && (() => {
                              const prev = clientHistory.slice(1, 8).map(d => d.index).filter(v => v != null) as number[];
                              if (!prev.length) return null;
                              const avgPrev = prev.reduce((s, v) => s + v, 0) / prev.length;
                              const diff = selectedClient.todayIndex - avgPrev;
                              return (
                                <span style={{ fontSize: 12, color: diff >= 0 ? 'var(--c-moss)' : 'var(--c-rose)', fontWeight: 500 }}>
                                  {diff >= 0 ? '+' : ''}{diff.toFixed(1)} к нед.
                                </span>
                              );
                            })()}
                          </div>
                          {clientHistory.length >= 3 && (
                            <ClientSparkline
                              values={clientHistory.slice(0, 14).map(d => d.index).reverse()}
                              color={indexColor(selectedClient.todayIndex)}
                            />
                          )}
                          {clientHistory.length > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>
                              {clientHistory.length} дн. · {clientHistory.length} оценок
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Needs today */}
                    {clientHistory.length > 0 && (() => {
                      const today = clientHistory[0];
                      if (!today || Object.keys(today.ratings).length === 0) return null;
                      const NEED_LABELS: Record<string, { label: string; color: string }> = {
                        attachment: { label: 'Привязанность', color: '#ff6b9d' },
                        autonomy:   { label: 'Автономия',     color: '#4fa3f7' },
                        expression: { label: 'Выражение чувств', color: '#facc15' },
                        play:       { label: 'Спонтанность',  color: '#06d6a0' },
                        limits:     { label: 'Границы',       color: '#a78bfa' },
                      };
                      return (
                        <>
                          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
                          <div className="section">
                            <div className="eyebrow" style={{ marginBottom: 14 }}>Потребности сегодня</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {Object.entries(NEED_LABELS).map(([id, { label, color }]) => {
                                const v = today.ratings[id];
                                if (v == null) return null;
                                return (
                                  <div key={id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{label}</div>
                                    <div style={{ width: 80, height: 3, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ width: `${v * 10}%`, height: '100%', background: color, borderRadius: 2 }} />
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: v <= 4 ? 'var(--c-rose)' : v <= 6 ? 'var(--c-amber)' : color, minWidth: 14, textAlign: 'right' }}>{v}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />

                    {/* Quick actions */}
                    <div className="section">
                      <div className="eyebrow" style={{ marginBottom: 14 }}>Действия</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          { label: '+ Заметка сессии', action: () => setClientTab('sessions') },
                          { label: '+ Назначить задание', action: () => setShowAssign(true) },
                          { label: '→ Запросить YSQ', action: () => setClientTab('ysq') },
                          { label: `↗ Экспорт концепта${exportCopied ? ' ✓' : ''}`, action: handleExport },
                        ].map(item => (
                          <button key={item.label} onClick={item.action} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--accent)', cursor: 'pointer' }}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            )}

            {/* ── CONCEPT ──────────────────────────────────────────────────────── */}
            {clientTab === 'concept' && (
              <div className="page-inner-wide" style={{ paddingTop: 40 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Концептуализация</div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>Схема-карта, цели терапии и связь с детским опытом</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {conceptDirty && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>несохранено</span>}
                    <button onClick={saveConcept} disabled={!conceptDirty || conceptSaving} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: conceptDirty ? 'var(--accent)' : 'var(--surface-3)', color: conceptDirty ? 'var(--on-accent)' : 'var(--text-faint)', fontSize: 13, fontWeight: 500, cursor: conceptDirty ? 'pointer' : 'default' }}>
                      {conceptSaving ? 'Сохраняю...' : 'Сохранить'}
                    </button>
                    <button onClick={handleExport} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>
                      ↗ Экспорт{exportCopied ? ' ✓' : ''}
                    </button>
                  </div>
                </div>

                {conceptError && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'color-mix(in srgb, var(--c-rose) 10%, transparent)', color: 'var(--c-rose)', fontSize: 13 }}>{conceptError}</div>}

                <div className="doc-grid">
                  <div>
                    {/* Goals */}
                    <div className="section">
                      <div className="eyebrow" style={{ marginBottom: 12 }}>Цели схема-терапии</div>
                      <textarea
                        className="textarea"
                        value={(localConcept.goals as string) ?? ''}
                        onChange={e => patchConcept({ goals: e.target.value })}
                        placeholder="Что должно измениться. Конкретные результаты, на которые направлена работа."
                        rows={3}
                        style={{ fontSize: 15, lineHeight: 1.6, borderColor: 'var(--accent-line)' }}
                      />
                    </div>

                    {/* Schema selection */}
                    <div className="section">
                      <div className="section-head" style={{ marginBottom: 20 }}>
                        <h3>Актуальные схемы</h3>
                        <span className="hint">{activeSchemaIds.length} активны из 20</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {SCHEMA_DOMAINS.map(domain => (
                          <div key={domain.id}>
                            <div className="eyebrow" style={{ color: domain.color, marginBottom: 10 }}>{domain.domain}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {domain.schemas.map(s => {
                                const active = activeSchemaIds.includes(s.id);
                                return (
                                  <button key={s.id} onClick={() => toggleSchemaId(s.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: active ? 600 : 400, background: active ? domain.color : 'var(--bg-alt)', color: active ? '#fff' : 'var(--text-faint)', border: `1px solid ${active ? domain.color : 'var(--line)'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
                                    {s.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mode selection */}
                    <div className="section">
                      <div className="section-head" style={{ marginBottom: 20 }}>
                        <h3>Карта режимов</h3>
                        <span className="hint">{activeModeIds.length} в работе</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {MODE_GROUPS.map(group => (
                          <div key={group.id}>
                            <div className="eyebrow" style={{ color: group.color, marginBottom: 10 }}>{group.group}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {group.items.map(m => {
                                const active = activeModeIds.includes(m.id);
                                return (
                                  <button key={m.id} onClick={() => toggleModeId(m.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: active ? 600 : 400, background: active ? group.color : 'var(--bg-alt)', color: active ? '#fff' : 'var(--text-faint)', border: `1px solid ${active ? group.color : 'var(--line)'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
                                    {m.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Text fields */}
                    {CONCEPT_FIELDS.map(field => (
                      <div key={field.key} className="section">
                        <div className="eyebrow" style={{ marginBottom: 12 }}>{field.label}</div>
                        <textarea
                          className="textarea"
                          value={(localConcept[field.key] as string) ?? ''}
                          onChange={e => patchConcept({ [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          rows={4}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Right sidebar */}
                  <aside>
                    <div className="eyebrow" style={{ marginBottom: 16 }}>Что заполнено</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {([
                        ['Цели терапии', !!(localConcept.goals || concept?.goals)],
                        ['Ранний опыт', !!(localConcept.earlyExperience || concept?.earlyExperience)],
                        ['Неудовл. потребности', !!(localConcept.unmetNeeds || concept?.unmetNeeds)],
                        ['Триггеры', !!(localConcept.triggers || concept?.triggers)],
                        ['Копинги', !!(localConcept.copingStyles || concept?.copingStyles)],
                        ['Переходы режимов', !!(localConcept.modeTransitions || concept?.modeTransitions)],
                        ['Актуальные проблемы', !!(localConcept.currentProblems || concept?.currentProblems)],
                      ] as [string, boolean][]).map(([label, has]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: has ? 'var(--accent)' : 'var(--text-ghost)', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: has ? 'var(--text)' : 'var(--text-faint)' }}>{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* YSQ cross-reference */}
                    {ysqSchemaIds.length > 0 && (
                      <>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
                        <div className="eyebrow" style={{ marginBottom: 14 }}>Сверка с YSQ</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {ysqSchemaIds.slice(0, 6).map(id => {
                            const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                            const inConcept = activeSchemaIds.includes(id);
                            return (
                              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{s?.name ?? id}</span>
                                {!inConcept && <span style={{ fontSize: 11, color: 'var(--c-amber)', fontWeight: 500 }}>+ добавить?</span>}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* History */}
                    {concept?.history && concept.history.length > 0 && (
                      <>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '28px 0' }} />
                        <div className="eyebrow" style={{ marginBottom: 12 }}>История версий</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                            <span style={{ fontSize: 13 }}>Текущая версия</span>
                          </div>
                          {concept.history.slice(0, 3).map((h, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-ghost)', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: 'var(--text-sub)', flex: 1 }}>Версия {concept.history.length - i}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{fmtDate(h.savedAt.slice(0, 10))}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </aside>
                </div>
              </div>
            )}

            {/* ── SESSIONS ─────────────────────────────────────────────────────── */}
            {clientTab === 'sessions' && (
              <div className="page-inner" style={{ paddingTop: 40 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 64, alignItems: 'start' }}>
                  {/* Notes timeline */}
                  <div>
                    {notes.length === 0 ? (
                      <div style={{ padding: '64px 0', color: 'var(--text-faint)', fontSize: 14, textAlign: 'center' }}>
                        Заметок ещё нет. Добавь первую справа.
                      </div>
                    ) : (
                      <div style={{ position: 'relative', paddingLeft: 28 }}>
                        {/* Vertical timeline line */}
                        <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--line)', borderRadius: 2 }} />
                        {notes.map((note, i) => (
                          <div key={note.id} style={{ position: 'relative', marginBottom: 36 }}>
                            {/* Timeline dot */}
                            <div style={{ position: 'absolute', left: -25, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg)', zIndex: 1 }} />
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtDate(note.date)}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-faint)', background: 'var(--surface-3)', borderRadius: 4, padding: '1px 6px' }}>
                                  Сессия {notes.length - i}
                                </span>
                              </div>
                              <button onClick={() => removeNote(note.id)} style={{ background: 'none', border: 'none', padding: '2px 6px', borderRadius: 4, fontSize: 12, color: 'var(--text-ghost)', cursor: 'pointer' }} title="Удалить">✕</button>
                            </div>
                            <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-sub)', whiteSpace: 'pre-wrap' }}>
                              {note.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Composer */}
                  <div style={{ position: 'sticky', top: 24 }}>
                    <div className="eyebrow" style={{ marginBottom: 12 }}>Новая заметка</div>
                    <div style={{ marginBottom: 10 }}>
                      <input
                        type="date"
                        value={newNoteDate || todayStr()}
                        onChange={e => setNewNoteDate(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <textarea
                      className="textarea"
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
                      rows={6}
                      placeholder="Наблюдения, гипотезы, динамика, план следующей встречи…"
                      style={{ fontSize: 13, lineHeight: 1.65 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>⌘+Enter</span>
                      <button onClick={addNote} disabled={!newNoteText.trim() || noteSaving} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        {noteSaving ? '...' : 'Сохранить'}
                      </button>
                    </div>
                    {noteError && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-rose)' }}>{noteError}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ── TASKS ────────────────────────────────────────────────────────── */}
            {clientTab === 'tasks' && (
              <div className="page-inner-wide" style={{ paddingTop: 40 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Задания</div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>{clientTasks.length} домашних практик</div>
                  </div>
                  <button onClick={() => setShowAssign(true)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    + Назначить
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 48 }}>
                  {([
                    ['active', 'Активные', 'var(--accent)'],
                    ['done', 'Завершённые', 'var(--c-moss)'],
                  ] as [string, string, string][]).map(([status, label, color]) => {
                    const items = status === 'done' ? clientTasks.filter(t => t.done === true) : clientTasks.filter(t => !t.done);
                    return (
                      <div key={status}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span className="eyebrow">{label}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{items.length}</span>
                        </div>
                        {items.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '12px 0' }}>—</div>}
                        {items.map(t => (
                          <div key={t.id} className="list-line">
                            <span style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${color}`, background: t.done ? color : 'transparent', flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>{t.text}</div>
                              {t.dueDate && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>до {fmtDate(t.dueDate)}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {clientTasks.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
                    Заданий пока нет. Назначь первое.
                  </div>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '48px 0 28px' }} />

                <div className="eyebrow" style={{ marginBottom: 18 }}>Шаблоны заданий</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
                  {[
                    { t: 'Схема-карточка', sub: 'Триггеры · чувства · мысли · корни · реальность · поведение' },
                    { t: 'Дневник режима', sub: '5–7 эпизодов · фокус на конкретном режиме' },
                    { t: 'Письмо себе', sub: 'От Здорового Взрослого к Уязвимому Ребёнку' },
                    { t: 'Imagery rescripting', sub: 'Аудио-практика, 12 минут' },
                  ].map(card => (
                    <div key={card.t} onClick={() => setShowAssign(true)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{card.t}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-sub)', marginTop: 6, lineHeight: 1.55 }}>{card.sub}</div>
                      <span style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: 'var(--accent)' }}>назначить →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── YSQ ──────────────────────────────────────────────────────────── */}
            {clientTab === 'ysq' && (
              <div className="page-inner-wide" style={{ paddingTop: 40 }}>
                {(!clientData?.ysqHistory || clientData.ysqHistory.length === 0) ? (
                  <div style={{ padding: '80px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
                    <div style={{ fontSize: 16, color: 'var(--text-sub)', marginBottom: 8 }}>YSQ ещё не проходился</div>
                    {selectedClient.telegramId < 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Клиент без Telegram — YSQ недоступен</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 24 }}>Запроси тест — клиент получит уведомление в боте</div>
                        <button onClick={handleRequestYsq} disabled={ysqRequested} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                          {ysqRequested ? '✓ Запрос отправлен' : 'Запросить тест YSQ'}
                        </button>
                        {ysqError && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--c-rose)' }}>{ysqError}</div>}
                      </>
                    )}

                    {selfSchemaIds.length > 0 && (
                      <div style={{ marginTop: 48, textAlign: 'left', maxWidth: 640, margin: '48px auto 0' }}>
                        <div className="eyebrow" style={{ marginBottom: 16 }}>Схемы, отмеченные клиентом самостоятельно</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {selfSchemaIds.map(id => {
                            const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                            const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === id));
                            return (
                              <div key={id} className="tag-mini">
                                <span className="swatch" style={{ background: domain?.color ?? 'var(--accent)' }} />
                                {s?.name ?? id}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (() => {
                  const hist = clientData.ysqHistory;
                  const latest = hist[0];
                  const prev = hist[1] ?? null;
                  // Chronological order for chart (oldest → newest)
                  const chronHist = hist.slice().reverse();
                  // Top 5 schemas by latest score
                  const top5 = latest.scores.slice().sort((a, b) => b.pct5plus - a.pct5plus).slice(0, 5);
                  const top5Ids = new Set(top5.map(s => s.id));
                  // All schemas sorted by latest score desc
                  const allSorted = latest.scores.slice().sort((a, b) => b.pct5plus - a.pct5plus);

                  // Chart geometry
                  const CL = 44, CR = 780, CT = 14, CB = 192, CW = CR - CL, CH = CB - CT;
                  const xOf = (i: number) => CL + (chronHist.length > 1 ? (i / (chronHist.length - 1)) * CW : CW / 2);
                  const yOf = (pct: number) => CB - (pct / 100) * CH;

                  return (
                    <div>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36 }}>
                        <div>
                          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', margin: 0 }}>YSQ</h2>
                          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6 }}>
                            {hist.length} {hist.length === 1 ? 'прохождение' : hist.length < 5 ? 'прохождения' : 'прохождений'} · последнее {clientData.ysqCompletedAt ? fmtDate(clientData.ysqCompletedAt.slice(0, 10)) : '—'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>
                            {exportCopied ? '✓ Скопировано' : 'Экспорт'}
                          </button>
                          {selectedClient.telegramId >= 0 && (
                            <button onClick={handleRequestYsq} disabled={ysqRequested} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                              {ysqRequested ? '✓ Запрос отправлен' : 'Запросить повтор'}
                            </button>
                          )}
                        </div>
                      </div>
                      {ysqError && <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--c-rose)' }}>{ysqError}</div>}

                      {/* Dynamics chart — only if ≥2 runs */}
                      {chronHist.length >= 2 && (
                        <div style={{ marginBottom: 48 }}>
                          <div className="eyebrow" style={{ marginBottom: 20 }}>Динамика топ-5 схем</div>
                          <svg viewBox="0 0 820 230" style={{ width: '100%', overflow: 'visible', display: 'block' }}>
                            {/* Grid lines */}
                            {[0, 25, 50, 75, 100].map(v => (
                              <g key={v}>
                                <line x1={CL} x2={CR} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth={1} />
                                <text x={CL - 8} y={yOf(v) + 4} fontSize={10} fill="var(--text-faint)" textAnchor="end">{v}</text>
                              </g>
                            ))}
                            {/* X axis dates */}
                            {chronHist.map((run, i) => (
                              <text key={i} x={xOf(i)} y={CB + 18} fontSize={10} fill="var(--text-faint)" textAnchor="middle">
                                {fmtDate(run.completedAt.slice(0, 10))}
                              </text>
                            ))}
                            {/* Lines for top 5 schemas */}
                            {top5.map(({ id }) => {
                              const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === id));
                              const color = domain?.color ?? 'var(--accent)';
                              const points = chronHist.map((run, i) => {
                                const sc = run.scores.find(s => s.id === id);
                                return sc ? `${xOf(i)},${yOf(sc.pct5plus)}` : null;
                              }).filter(Boolean).join(' ');
                              const lastRun = chronHist[chronHist.length - 1];
                              const lastScore = lastRun.scores.find(s => s.id === id);
                              return (
                                <g key={id}>
                                  <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" opacity={0.75} />
                                  {lastScore && (
                                    <circle cx={xOf(chronHist.length - 1)} cy={yOf(lastScore.pct5plus)} r={4} fill={color} />
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                          {/* Legend */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 12 }}>
                            {top5.map(({ id }) => {
                              const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                              const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === id));
                              return (
                                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 10, height: 10, borderRadius: 2, background: domain?.color ?? 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
                                  <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>{s?.name ?? id}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* All scales table */}
                      <div>
                        <div className="eyebrow" style={{ marginBottom: 16 }}>Все шкалы</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)', gap: '0 8px', marginBottom: 8 }}>
                          <span className="eyebrow">Схема</span>
                          <span className="eyebrow" style={{ textAlign: 'right' }}>{fmtDate(latest.completedAt.slice(0, 10))}</span>
                          {prev && <span className="eyebrow" style={{ textAlign: 'right' }}>{fmtDate(prev.completedAt.slice(0, 10))}</span>}
                          {prev && <span className="eyebrow" style={{ textAlign: 'right' }}>Δ</span>}
                        </div>
                        {allSorted.map(score => {
                          const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === score.id);
                          const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === score.id));
                          const prevScore = prev?.scores.find(x => x.id === score.id);
                          const delta = prevScore != null ? score.pct5plus - prevScore.pct5plus : null;
                          const isTop5 = top5Ids.has(score.id);
                          return (
                            <div key={score.id} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)', gap: '0 8px', padding: '11px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 3, height: 18, borderRadius: 2, background: domain?.color ?? 'var(--accent)', flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: isTop5 ? 600 : 400, color: isTop5 ? 'var(--text)' : 'var(--text-sub)' }}>{s?.name ?? score.id}</span>
                              </div>
                              <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, color: score.pct5plus > 65 ? 'var(--c-rose)' : score.pct5plus > 50 ? 'var(--c-clay)' : 'var(--text-sub)' }}>
                                {score.pct5plus}%
                              </span>
                              {prev && (
                                <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-faint)' }}>
                                  {prevScore != null ? `${prevScore.pct5plus}%` : '—'}
                                </span>
                              )}
                              {prev && (
                                <span style={{ textAlign: 'right', fontSize: 13, fontWeight: delta != null && delta !== 0 ? 500 : 400, color: delta == null || delta === 0 ? 'var(--text-faint)' : delta < 0 ? 'var(--c-moss)' : 'var(--c-rose)' }}>
                                  {delta == null ? '—' : delta === 0 ? '0' : `${delta > 0 ? '+' : ''}${delta}`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── CLIENT NOTES ─────────────────────────────────────────────────── */}
            {clientTab === 'client_notes' && (
              <div className="page-inner" style={{ paddingTop: 40 }}>
                {clientSchemaNotesData.length === 0 && clientModeNotesData.length === 0 && clientDiary.length === 0 ? (
                  <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
                    Клиент ещё не заполнял дневник
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Записи клиента</div>
                        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
                          {clientDiary.length + clientSchemaNotesData.length + clientModeNotesData.length} записей
                        </div>
                      </div>
                    </div>

                    {/* Diary entries (schema diary, mode diary, gratitude) */}
                    {clientDiary.length > 0 && (
                      <div style={{ marginBottom: 40 }}>
                        <div className="eyebrow" style={{ marginBottom: 16 }}>Дневник событий</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {clientDiary.map((entry, i) => {
                            let color = 'var(--text-faint)';
                            let title = '';
                            let typeLabel = '';
                            if (entry.type === 'schema') {
                              const firstId = entry.schemaIds?.[0];
                              const domain = firstId ? SCHEMA_DOMAINS.find(d => d.schemas.some(s => s.id === firstId)) : null;
                              const schema = firstId ? SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.id === firstId) : null;
                              color = domain?.color ?? 'var(--accent)';
                              title = schema ? `${schema.emoji} ${schema.name}` : (entry.schemaIds?.join(', ') ?? 'Схема');
                              if ((entry.schemaIds?.length ?? 0) > 1) title += ` +${(entry.schemaIds?.length ?? 1) - 1}`;
                              typeLabel = 'Схема-дневник';
                            } else if (entry.type === 'mode') {
                              const mode = getModeById(entry.modeId ?? '');
                              const group = mode ? MODE_GROUPS.find(g => g.items.some(m => m.id === entry.modeId)) : null;
                              color = group?.color ?? 'var(--accent-violet)';
                              title = mode ? `${mode.emoji} ${mode.name}` : (entry.modeId ?? 'Режим');
                              typeLabel = 'Режим-дневник';
                            } else {
                              color = '#06d6a0';
                              title = 'Благодарность';
                              typeLabel = 'Дневник благодарности';
                            }
                            return (
                              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', borderRadius: 10, background: 'var(--surface-2)', borderLeft: `3px solid ${color}` }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-faint)', background: 'var(--surface-3)', borderRadius: 4, padding: '1px 6px' }}>{typeLabel}</span>
                                  </div>
                                  {entry.excerpt && (
                                    <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
                                      {entry.excerpt}
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0, paddingTop: 2 }}>{fmtDate(entry.date)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {clientSchemaNotesData.length > 0 && (
                      <div>
                        <div className="eyebrow" style={{ marginBottom: 16 }}>Схема-карточки</div>
                        {clientSchemaNotesData.map(n => {
                          const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === n.schemaId);
                          const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === n.schemaId));
                          return (
                            <div key={n.schemaId} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ width: 3, height: 16, borderRadius: 2, background: domain?.color ?? 'var(--accent)', flexShrink: 0 }} />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{s?.emoji} {s?.name ?? n.schemaId}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Схема-карточка</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 28px' }}>
                                {[
                                  { label: 'Триггеры', val: n.triggers },
                                  { label: 'Чувства', val: n.feelings },
                                  { label: 'Мысли', val: n.thoughts },
                                  { label: 'Корни', val: n.origins },
                                  { label: 'Проверка реальности', val: n.reality },
                                  { label: 'Здоровый взгляд', val: n.healthyView },
                                  { label: 'Поведение', val: n.behavior },
                                ].filter(f => f.val?.trim()).map(f => (
                                  <div key={f.label}>
                                    <div className="eyebrow" style={{ marginBottom: 4 }}>{f.label}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.val}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {clientModeNotesData.length > 0 && (
                      <div style={{ marginTop: clientSchemaNotesData.length > 0 ? 36 : 0 }}>
                        <div className="eyebrow" style={{ marginBottom: 16 }}>Режим-карточки</div>
                        {clientModeNotesData.map(n => {
                          const m = getModeById(n.modeId);
                          const group = MODE_GROUPS.find(g => g.items.some(x => x.id === n.modeId));
                          return (
                            <div key={n.modeId} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ width: 3, height: 16, borderRadius: 2, background: group?.color ?? 'var(--accent)', flexShrink: 0 }} />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{m?.emoji} {m?.name ?? n.modeId}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Режим-карточка</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 28px' }}>
                                {[
                                  { label: 'Триггеры', val: n.triggers },
                                  { label: 'Чувства', val: n.feelings },
                                  { label: 'Мысли', val: n.thoughts },
                                  { label: 'Потребности', val: n.needs },
                                  { label: 'Поведение', val: n.behavior },
                                ].filter(f => f.val?.trim()).map(f => (
                                  <div key={f.label}>
                                    <div className="eyebrow" style={{ marginBottom: 4 }}>{f.label}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.val}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── ASSIGN TASK MODAL ─────────────────────────────────────────────────── */}

      {showAssign && selectedClient && (
        <TaskCreateSheet
          clientId={selectedClient.telegramId}
          clientName={selectedClient.name ?? undefined}
          onCreated={async () => {
            setShowAssign(false);
            const tasks = await api.getTherapyTasksForClient(selectedClient.telegramId).catch(() => []);
            setClientTasks(tasks);
          }}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}

// ── Kanban ────────────────────────────────────────────────────────────────────

function ClientSparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const pts = values.map((v, i) => v !== null ? { x: i, y: v } : null).filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return null;
  const W = 180, H = 48;
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));
  const range = maxY - minY || 1;
  const n = values.length - 1 || 1;
  const d = pts.map(p => `${(p.x / n) * W},${H - ((p.y - minY) / range) * (H - 8) - 4}`).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block', marginTop: 8 }}>
      <polyline points={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={0.6} />
      <circle cx={(pts[pts.length - 1].x / n) * W} cy={H - ((pts[pts.length - 1].y - minY) / range) * (H - 8) - 4} r={3} fill={color} opacity={0.9} />
    </svg>
  );
}

function KanbanView({ allTasks, loading, onOpenClient }: {
  allTasks: { clientId: number; clientName: string; tasks: UserTask[] }[] | null;
  loading: boolean;
  onOpenClient: (clientId: number) => void;
}) {
  if (loading || !allTasks) {
    return <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-faint)' }}>Загрузка...</div>;
  }

  const flat = allTasks.flatMap(group =>
    group.tasks.map(t => ({ ...t, clientName: group.clientName }))
  );

  if (flat.length === 0) {
    return (
      <div className="section" style={{ paddingTop: 32 }}>
        <div className="text-md muted">Назначенных заданий пока нет</div>
      </div>
    );
  }

  const pending   = flat.filter(t => t.done === null);
  const completed = flat.filter(t => t.done === true);
  const failed    = flat.filter(t => t.done === false);

  const cols: { label: string; items: typeof flat; color: string }[] = [
    { label: 'Назначено',  items: pending,   color: 'var(--accent)' },
    { label: 'Выполнено',  items: completed, color: 'var(--c-moss)' },
    { label: 'Не вышло',   items: failed,    color: 'var(--c-rose)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>
      {cols.map(col => (
        <div key={col.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span className="eyebrow">{col.label}</span>
            {col.items.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: col.color, background: `color-mix(in srgb, ${col.color} 12%, transparent)`, borderRadius: 10, padding: '1px 8px' }}>
                {col.items.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {col.items.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>—</div>
            )}
            {col.items.map(task => (
              <div
                key={task.id}
                onClick={() => onOpenClient(task.userId)}
                style={{
                  background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px',
                  cursor: 'pointer', border: '1px solid var(--line)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = col.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: col.color, marginBottom: 6 }}>
                  {task.clientName}
                </div>
                <div className="text-sm" style={{ lineHeight: 1.5, color: 'var(--text)' }}>{task.text}</div>
                {task.dueDate && (
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>до {task.dueDate}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
