import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TherapyClientSummary, UserTask, ClientConceptualization } from '../api';
import { TaskCreateSheet } from './TaskCreateSheet';
import { fmtDate, todayStr } from '../utils/format';
import { SCHEMA_DOMAINS, MODE_GROUPS, getModeById } from '../schemaTherapyData';
import { RosterSparkline, ClientSparkline } from './therapist/Sparklines';
import { KanbanView } from './therapist/KanbanView';
import { ClientNotesTab } from './therapist/ClientNotesTab';
import { ClientYSQTab } from './therapist/ClientYSQTab';
import { useClientDetail } from './therapist/useClientDetail';
import { useAddClient } from './therapist/useAddClient';
import { ModeMapSelector } from './ModeMapSelector';

interface Props {
  view: 'list' | 'client';
  openClientId?: number | null;
  onViewChange: (v: 'list' | 'client') => void;
  onOpenClient?: (id: number) => void;
  onClose: () => void;
  backHandlerRef?: React.MutableRefObject<() => void>;
  onClientsChange?: (clients: TherapyClientSummary[]) => void;
}

type ClientTab = 'overview' | 'concept' | 'mode_map' | 'sessions' | 'tasks' | 'ysq' | 'client_notes';

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
  if (v >= 7) return 'var(--c-moss)';
  if (v >= 5) return 'var(--text)';
  return 'var(--c-rose)';
}

const CONCEPT_FIELDS: { key: keyof ClientConceptualization; label: string; placeholder: string }[] = [
  { key: 'earlyExperience', label: 'Ранний дисфункциональный опыт', placeholder: 'Значимые события и паттерны из детства и юности, которые сформировали схемы...' },
  { key: 'unmetNeeds', label: 'Неудовлетворённые базовые потребности', placeholder: 'Привязанность, автономия, свобода выражения, игра/спонтанность, реалистичные границы...' },
  { key: 'triggers', label: 'Схемные триггеры', placeholder: 'Ситуации, слова, интонации, отношения – что запускает схемные реакции...' },
  { key: 'copingStyles', label: 'Стили совладания', placeholder: 'Капитуляция, избегание, гиперкомпенсация – типичные паттерны для каждой схемы...' },
  { key: 'modeTransitions', label: 'Переключение режимов', placeholder: 'Что запускает переход в уязвимого ребёнка? Как активируется карающий критик? Когда появляется здоровый взрослый?...' },
  { key: 'currentProblems', label: 'Актуальные проблемы и симптомы', placeholder: 'С чем обратился клиент, текущие жалобы, симптоматика...' },
];



export function TherapistClientSheet({ view, openClientId: openClientIdProp, onViewChange, onOpenClient, onClose: _onClose, backHandlerRef, onClientsChange: _onClientsChange }: Props) {
  // ─── Client list ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTab, setListTab] = useState<'clients' | 'kanban'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'wait' | 'virtual'>('all');
  const [allTasks, setAllTasks] = useState<{ clientId: number; clientName: string; tasks: UserTask[] }[] | null>(null);
  const [allTasksLoading, setAllTasksLoading] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  function switchView(v: 'list' | 'client') {
    setAnimKey(k => k + 1);
    onViewChange(v);
  }

  // ─── Hooks ────────────────────────────────────────────────────────────────────
  const detail = useClientDetail({ onOpenClient, switchView, setClients });
  const addClient = useAddClient({ setClients });

  // ─── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    api.getTherapyClients().then(cl => {
      setClients(cl);
      if (openClientIdProp) {
        const c = cl.find(x => x.telegramId === openClientIdProp);
        if (c) detail.openClient(c);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Sync sidebar when clients list changes (e.g. after adding a client) ──────
  useEffect(() => {
    _onClientsChange?.(clients);
  }, [clients]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── React to URL-driven client navigation ────────────────────────────────────
  useEffect(() => {
    if (!openClientIdProp || loading) return;
    if (detail.selectedClient?.telegramId === openClientIdProp) return;
    const c = clients.find(x => x.telegramId === openClientIdProp);
    if (c) detail.openClient(c);
  }, [openClientIdProp, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Back button handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!backHandlerRef || view !== 'client') return;
    backHandlerRef.current = () => {
      if (detail.showAssign) { detail.setShowAssign(false); return; }
      switchView('list');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, detail.showAssign, backHandlerRef]);

  // ─── Destructure for JSX convenience ─────────────────────────────────────────
  const {
    selectedClient, clientSchemaNotesData, clientModeNotesData,
    clientTasks, setClientTasks, notes, noteError,
    concept, clientData, clientHistory, clientDiary,
    localConcept, conceptError, expandedSnapshot, setExpandedSnapshot,
    saveStatus, newNoteText, setNewNoteText, newNoteDate, setNewNoteDate,
    noteSaving, showAssign, setShowAssign,
    editingStartDate, setEditingStartDate, localStartDate, setLocalStartDate,
    editingNextSession, setEditingNextSession, localNextSession, setLocalNextSession,
    sessionInfoSaving, renamingAlias, setRenamingAlias, aliasInput, setAliasInput,
    aliasSaving, aliasError, ysqRequested, ysqError, exportCopied,
    deleteLoading, deleteError, tabLoading, clientTab, setClientTab,
    activeSchemaIds, activeModeIds, ysqSchemaIds, selfSchemaIds,
    openClient, deleteClient, addNote, removeNote,
    patchConcept, toggleSchemaId, toggleModeId,
    saveAlias, saveSessionInfo, handleRequestYsq, handleExport,
  } = detail;

  const {
    addMode, addInput, setAddInput, addLoading, addError,
    inviteUrl, inviteCopied, inviteLoading, inviteInputRef,
    openAddMode, createInvite, copyInvite, shareInvite,
    addByTelegramId, addVirtualClient,
  } = addClient;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── LIST VIEW ──────────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div key={`list-${animKey}`} style={{ animation: 'fade-in 0.22s ease', flex: 1, overflow: 'auto' }}>
          <div className="page-inner-wide">

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
              <div>
                <h1 className="hub-title" style={{ marginBottom: 8 }}>Кабинет</h1>
                <div style={{ fontSize: 15, color: 'var(--text-sub)', marginTop: 0 }}>
                  {clients.length} {clients.length === 1 ? 'клиент' : clients.length < 5 ? 'клиента' : 'клиентов'} · {clients.filter(c => c.lastActiveDate === todayStr()).length} активны сегодня
                </div>
              </div>
              <button
                onClick={() => openAddMode(addMode ? null : 'invite')}
                className={addMode ? 'btn btn-secondary' : 'btn btn-primary'}
              >
                {addMode ? '✕ Закрыть' : '+ Добавить клиента'}
              </button>
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <div className="tabs" style={{ marginBottom: 0 }}>
                <button className={`tab ${listTab === 'clients' ? 'is-active' : ''}`} onClick={() => setListTab('clients')}>
                  Клиенты{clients.length > 0 && <span className="count">{clients.length}</span>}
                </button>
                <button className={`tab ${listTab === 'kanban' ? 'is-active' : ''}`} onClick={() => {
                  setListTab('kanban');
                  if (!allTasks && !allTasksLoading) {
                    setAllTasksLoading(true);
                    api.getAllTherapyTasks().then(setAllTasks).catch(() => setAllTasks([])).finally(() => setAllTasksLoading(false));
                  }
                }}>Задания</button>
              </div>
              {listTab === 'clients' && (<>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                       placeholder="Найти клиента" className="input"
                       style={{ maxWidth: 320, background: 'transparent', borderColor: 'var(--line)' }} />
                <div style={{ display: 'flex', gap: 2 }}>
                  {(['all', 'active', 'wait', 'virtual'] as const).map((k) => {
                    const label = { all: 'Все', active: 'Активны', wait: 'Ждут', virtual: 'Оффлайн' }[k];
                    return (
                      <button key={k} onClick={() => setFilterStatus(k)}
                              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12.5, border: 'none', cursor: 'pointer',
                                       fontWeight: filterStatus === k ? 600 : 500,
                                       background: filterStatus === k ? 'var(--surface-3)' : 'transparent',
                                       color: filterStatus === k ? 'var(--text)' : 'var(--text-faint)' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>)}
            </div>

            {/* Add client panel */}
            {addMode && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '24px', marginBottom: 36 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {(['invite', 'telegram', 'virtual'] as const).map(m => (
                    <button key={m} onClick={() => openAddMode(m)} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${addMode === m ? 'var(--text)' : 'var(--line)'}`, background: addMode === m ? 'var(--text)' : 'transparent', color: addMode === m ? 'var(--bg)' : 'var(--text-faint)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
                      {{ invite: '🔗 Пригласить', telegram: '🔢 Telegram ID', virtual: '👤 Оффлайн' }[m]}
                    </button>
                  ))}
                </div>

                {addMode === 'invite' && (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>Отправь клиенту ссылку – он перейдёт и автоматически подключится.</div>
                    {!inviteUrl ? (
                      <button onClick={createInvite} disabled={inviteLoading} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        {inviteLoading ? 'Создаю...' : 'Создать ссылку'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input ref={inviteInputRef} readOnly value={inviteUrl} style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 12, color: 'var(--text-sub)', fontFamily: 'monospace' }} />
                        <button onClick={copyInvite} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: inviteCopied ? 'var(--c-moss)' : 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
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
                      <button onClick={addByTelegramId} disabled={addLoading} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        {addLoading ? '...' : 'Добавить'}
                      </button>
                    </div>
                  </div>
                )}

                {addMode === 'virtual' && (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>Для клиентов без Telegram – концептуализация и заметки без привязки к боту</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={addInput} onChange={e => setAddInput(e.target.value)} placeholder="Имя клиента" style={{ width: 240, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13 }} />
                      <button onClick={addVirtualClient} disabled={addLoading} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        {addLoading ? '...' : 'Создать'}
                      </button>
                    </div>
                  </div>
                )}

                {addError && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--c-rose)' }}>{addError}</div>}
              </div>
            )}

            {/* Today dashboard – только если есть РЕАЛЬНЫЕ сегодняшние данные */}
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
                            <span className="num text-md" style={{ width: 52, flexShrink: 0, color: 'var(--text-sub)', fontWeight: 500 }}>{timePart ?? '–'}</span>
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

            {/* Client roster */}
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
                    <div className="list-line"><div style={{ flex: 1 }}><div className="text-md" style={{ fontWeight: 500 }}>Telegram ID</div><div className="text-sm muted" style={{ marginTop: 3 }}>если знаешь его ID – добавишь сразу</div></div></div>
                    <div className="list-line"><div style={{ flex: 1 }}><div className="text-md" style={{ fontWeight: 500 }}>Оффлайн</div><div className="text-sm muted" style={{ marginTop: 3 }}>клиент без Telegram – заметки и концептуализация без бота</div></div></div>
                  </div>
                </div>
              ) : (() => {
                const today = todayStr();
                const q = searchQuery.toLowerCase().trim();
                let filtered = q ? clients.filter(c => (c.clientAlias ?? c.name ?? '').toLowerCase().includes(q)) : clients.slice();
                if (filterStatus === 'active') filtered = filtered.filter(c => c.lastActiveDate === today);
                else if (filterStatus === 'wait') filtered = filtered.filter(c => c.lastActiveDate !== today && !!c.name);
                else if (filterStatus === 'virtual') filtered = filtered.filter(c => !c.name);
                const hasOnline = filtered.some(c => !!c.name);
                return (
                  <div>
                    {filtered.length === 0 && (
                      <div className="text-md muted" style={{ padding: '24px 0' }}>Ничего не найдено</div>
                    )}
                    {hasOnline && (
                      <>
                        <div className="r-row-head">
                          <span className="eyebrow">Клиент</span>
                          <span className="eyebrow" style={{ textAlign: 'right' }}>Индекс</span>
                          <span className="eyebrow">14 дн.</span>
                          <span className="eyebrow">Активные схемы</span>
                        </div>
                        {filtered.filter(c => !!c.name).map(client => (
                          <div key={client.telegramId} className="r-row" onClick={() => openClient(client)} style={{ cursor: 'pointer' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="text-base" style={{ fontWeight: 600 }}>{client.clientAlias ?? client.name}</span>
                                {client.lastActiveDate === today && (
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-moss)', flexShrink: 0 }} />
                                )}
                              </div>
                              <div className="text-xs faint" style={{ marginTop: 3 }}>
                                {client.lastActiveDate === today ? 'активен сегодня' : client.lastActiveDate ? 'был недавно' : 'не активен'}
                                {client.streak > 0 && ` · стрик ${client.streak} дн.`}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              {client.todayIndex != null ? (
                                <span className="num" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: indexColor(client.todayIndex) }}>{client.todayIndex.toFixed(1)}</span>
                              ) : <span className="text-sm faint">–</span>}
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
                              }) : <span className="text-xs faint">–</span>}
                              {client.schemaIds.length > 3 && <span className="text-xs faint">+{client.schemaIds.length - 3}</span>}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {filtered.filter(c => !c.name).length > 0 && (
                      <div style={{ marginTop: hasOnline ? 32 : 0 }}>
                        {hasOnline && <div className="eyebrow" style={{ marginBottom: 12 }}>Оффлайн-клиенты</div>}
                        {filtered.filter(c => !c.name).map(client => {
                          const name = client.clientAlias ?? `ID ${client.telegramId}`;
                          return (
                            <div key={client.telegramId} className="list-line" onClick={() => openClient(client)} style={{ cursor: 'pointer' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span className="text-md" style={{ fontWeight: 600 }}>{name}</span>
                                  <span className="chip chip-line" style={{ fontSize: 11 }}>оффлайн</span>
                                </div>
                                <div className="text-sm muted" style={{ marginTop: 3 }}>
                                  {client.therapyStartDate ? `с ${fmtDate(client.therapyStartDate)}` : 'без Telegram'}
                                  {client.nextSession && ` · ${nextSessionLabel(client.nextSession)}`}
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

          {/* Client header — moderately compact */}
          <div style={{ borderBottom: '1px solid var(--line)', padding: '24px 48px 0', flexShrink: 0 }}>
            {/* Row 1: back + name + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <button onClick={() => switchView('list')}
                style={{ background: 'none', border: 'none', fontSize: 12.5, color: 'var(--text-faint)', cursor: 'pointer', padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
                ← Все клиенты
              </button>
              <span style={{ color: 'rgba(var(--fg-rgb),0.15)', fontSize: 12 }}>|</span>

              {/* Name / inline edit */}
              {renamingAlias ? (
                <>
                  <input autoFocus value={aliasInput} onChange={e => setAliasInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveAlias(); if (e.key === 'Escape') setRenamingAlias(false); }}
                    style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', width: 220, padding: '1px 0', color: 'var(--text)' }} />
                  <button onClick={saveAlias} disabled={aliasSaving} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 12, cursor: 'pointer' }}>
                    {aliasSaving ? '…' : 'OK'}
                  </button>
                  <button onClick={() => setRenamingAlias(false)} style={{ padding: '3px 7px', borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                  {aliasError && <span style={{ fontSize: 12, color: 'var(--c-rose)' }}>{aliasError}</span>}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 380 }}>
                    {selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`}
                  </span>
                  <button onClick={() => { setRenamingAlias(true); setAliasInput(selectedClient.clientAlias ?? selectedClient.name ?? ''); }}
                    style={{ background: 'none', border: 'none', padding: '2px 5px', borderRadius: 4, color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }} title="Переименовать">✎</button>
                  {/* Inline meta */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
                    {selectedClient.lastActiveDate === todayStr() && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--c-moss)', flexShrink: 0 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--c-moss)' }} />был сегодня
                      </span>
                    )}
                    {!selectedClient.name && (
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>оффлайн</span>
                    )}
                    {selectedClient.therapyStartDate && (
                      <span style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {calcTherapyDuration(selectedClient.therapyStartDate)}
                      </span>
                    )}
                    {selectedClient.nextSession && (
                      <span style={{ fontSize: 12, color: 'var(--text-sub)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        сессия {nextSessionLabel(selectedClient.nextSession)}
                      </span>
                    )}
                    {selectedClient.streak > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>🔥 {selectedClient.streak} дн.</span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions — right */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 'auto', alignItems: 'center' }}>
                <button onClick={() => setShowAssign(true)} className="btn btn-primary">+ Задание</button>
                <button onClick={() => setClientTab('sessions')} className="btn btn-secondary">+ Заметка</button>
                <button onClick={deleteClient} disabled={deleteLoading} title="Удалить клиента"
                  style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', fontSize: 14, color: 'var(--text-faint)', cursor: 'pointer' }}>
                  {deleteLoading ? '…' : '🗑'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {([
                ['overview', 'Обзор', null],
                ['concept', 'Концептуализация', null],
                ['mode_map', 'Карта режимов', null],
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

            {/* Loading state */}
            {tabLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
                <div className="spinner" />
              </div>
            ) : <>

            {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
            {clientTab === 'overview' && (
              <div className="page-inner-wide" style={{ paddingTop: 40 }}>
                <div className="doc-grid">
                  <div>
                    {/* Therapy goals – shown as a quiet quote */}
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
                                  <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>–</div>
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
                              color = group?.color ?? 'var(--c-plum)';
                              title = mode ? `${mode.emoji} ${mode.name}` : (entry.modeId ?? 'Режим');
                              typeLabel = 'Режим-дневник';
                            } else {
                              color = 'var(--c-moss)';
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
                    {activeSchemaIds.length === 0 && activeModeIds.length === 0 && notes.length === 0 && clientDiary.length === 0 && (
                      <div className="section">
                        <div style={{ padding: '32px 0', color: 'var(--text-faint)', fontSize: 14 }}>
                          Заполни концептуализацию, чтобы увидеть схемы и режимы клиента
                        </div>
                        <button onClick={() => setClientTab('concept')} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
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
                            <button onClick={async () => { await saveSessionInfo({ nextSession: localNextSession || null }); setEditingNextSession(false); }} disabled={sessionInfoSaving} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 12, cursor: 'pointer' }}>
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
                            <button onClick={async () => { await saveSessionInfo({ therapyStartDate: localStartDate || null }); setEditingStartDate(false); }} disabled={sessionInfoSaving} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 12, cursor: 'pointer' }}>
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
                        attachment: { label: 'Привязанность', color: 'var(--c-plum)' },
                        autonomy:   { label: 'Автономия',     color: 'var(--c-slate)' },
                        expression: { label: 'Выражение чувств', color: 'var(--c-rose)' },
                        play:       { label: 'Спонтанность',  color: 'var(--c-moss)' },
                        limits:     { label: 'Границы',       color: 'var(--c-amber)' },
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
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)', minWidth: 120, textAlign: 'right' }}>
                      {saveStatus === 'saving' ? 'сохраняю…' : saveStatus === 'saved' ? '✓ сохранено' : saveStatus === 'pending' ? 'автосохранение' : ''}
                    </span>
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
                                  <button key={s.id} onClick={() => toggleSchemaId(s.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: active ? 600 : 400, background: active ? domain.color : 'var(--surface-2)', color: active ? 'var(--on-accent)' : 'var(--text-faint)', border: `1px solid ${active ? domain.color : 'var(--line)'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
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
                                  <button key={m.id} onClick={() => toggleModeId(m.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: active ? 600 : 400, background: active ? group.color : 'var(--surface-2)', color: active ? 'var(--on-accent)' : 'var(--text-faint)', border: `1px solid ${active ? group.color : 'var(--line)'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
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
                      <div key={String(field.key)} className="section">
                        <div className="eyebrow" style={{ marginBottom: 12 }}>{field.label}</div>
                        <textarea
                          className="textarea"
                          value={(localConcept[field.key as keyof ClientConceptualization] as string) ?? ''}
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
                        <div className="eyebrow" style={{ marginBottom: 12 }}>История версий · {concept.history.length}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {concept.history.slice(0, 5).map((h: any, i: number) => {
                            const vNum = concept.history.length - i;
                            const isOpen = expandedSnapshot === i;
                            const textFields: { label: string; val: string | null }[] = [
                              { label: 'Ранний опыт', val: h.earlyExperience },
                              { label: 'Неудовл. потребности', val: h.unmetNeeds },
                              { label: 'Триггеры', val: h.triggers },
                              { label: 'Копинг-стратегии', val: h.copingStyles },
                              { label: 'Цели', val: h.goals },
                              { label: 'Текущие проблемы', val: h.currentProblems },
                              { label: 'Переходы режимов', val: h.modeTransitions ?? null },
                            ].filter(f => f.val?.trim());
                            return (
                              <div key={i} style={{ borderRadius: 8, border: '1px solid var(--line)', overflow: 'hidden' }}>
                                <button
                                  onClick={() => setExpandedSnapshot(isOpen ? null : i)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: isOpen ? 'var(--surface-2)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-ghost)', flexShrink: 0 }} />
                                  <span style={{ fontSize: 13, color: 'var(--text-sub)', flex: 1 }}>Версия {vNum}</span>
                                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{fmtDate(h.savedAt.slice(0, 10))}</span>
                                  <span style={{ fontSize: 11, color: 'var(--text-ghost)', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
                                </button>
                                {isOpen && (
                                  <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                                    {/* Schema chips */}
                                    {h.schemaIds.length > 0 && (
                                      <div style={{ marginBottom: 10 }}>
                                        <div className="eyebrow" style={{ marginBottom: 6 }}>Схемы</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                          {h.schemaIds.map((id: string) => {
                                            const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                                            const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === id));
                                            return (
                                              <span key={id} className="tag-mini">
                                                <span className="swatch" style={{ background: domain?.color ?? 'var(--accent)' }} />
                                                {s?.name ?? id}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    {/* Mode chips */}
                                    {h.modeIds.length > 0 && (
                                      <div style={{ marginBottom: 10 }}>
                                        <div className="eyebrow" style={{ marginBottom: 6 }}>Режимы</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                          {h.modeIds.map((id: string) => {
                                            const m = getModeById(id);
                                            const group = MODE_GROUPS.find(g => g.items.some(x => x.id === id));
                                            return (
                                              <span key={id} className="tag-mini">
                                                <span className="swatch" style={{ background: group?.color ?? 'var(--c-plum)' }} />
                                                {m?.name ?? id}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    {/* Text fields */}
                                    {textFields.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {textFields.map(f => (
                                          <div key={f.label}>
                                            <div className="eyebrow" style={{ marginBottom: 2 }}>{f.label}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{f.val}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {h.schemaIds.length === 0 && h.modeIds.length === 0 && textFields.length === 0 && (
                                      <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Нет данных</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </aside>
                </div>
              </div>
            )}

            {/* ── MODE MAP — keep mounted to preserve React Flow state across tab switches */}
            {selectedClient != null && clientTab === 'mode_map' && (
              <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <ModeMapSelector key={selectedClient.telegramId} clientId={selectedClient.telegramId} />
              </div>
            )}

            {/* ── SESSIONS ─────────────────────────────────────────────────────── */}
            {clientTab === 'sessions' && (
              <div className="page-inner" style={{ paddingTop: 40 }}>
                {/* Composer */}
                <div style={{ marginBottom: 0 }}>
                  <div className="eyebrow" style={{ marginBottom: 16 }}>
                    Новая заметка · {fmtDate(newNoteDate || todayStr())}
                    <input type="date" value={newNoteDate || todayStr()} onChange={e => setNewNoteDate(e.target.value)}
                           style={{ marginLeft: 10, fontSize: 11, padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4, background: 'transparent', color: 'var(--text-faint)' }} />
                  </div>
                  <textarea
                    className="textarea"
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
                    rows={4}
                    placeholder="Наблюдения, гипотезы, динамика, план следующей встречи…"
                    style={{ fontSize: 15, lineHeight: 1.65 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>⌘+Enter – сохранить</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {newNoteText.trim() && (
                        <button onClick={() => setNewNoteText('')} className="btn btn-secondary">Отмена</button>
                      )}
                      <button onClick={addNote} disabled={!newNoteText.trim() || noteSaving} className="btn btn-primary">
                        {noteSaving ? '...' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                  {noteError && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--c-rose)' }}>{noteError}</div>}
                </div>

                <hr className="hr-soft" style={{ margin: '48px 0' }} />

                {/* Archive */}
                <div className="eyebrow" style={{ marginBottom: 32 }}>Архив · {notes.length} заметок</div>
                {notes.length === 0 ? (
                  <div style={{ color: 'var(--text-faint)', fontSize: 14 }}>Заметок пока нет</div>
                ) : (
                  notes.map((note, i) => (
                    <div key={note.id} style={{ marginBottom: 48 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{fmtDate(note.date)}</span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Сессия {notes.length - i}</span>
                        </div>
                        <button onClick={() => removeNote(note.id)} style={{ background: 'none', border: 'none', padding: '2px 6px', borderRadius: 4, fontSize: 12, color: 'var(--text-ghost)', cursor: 'pointer' }}>✕</button>
                      </div>
                      <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-sub)', maxWidth: 720, whiteSpace: 'pre-wrap' }}>
                        {note.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── TASKS ────────────────────────────────────────────────────────── */}
            {clientTab === 'tasks' && (() => {
              const activeTasks  = clientTasks.filter(t => !t.done);
              const doneTasks    = clientTasks.filter(t => t.done === true);
              return (
              <div className="page-inner" style={{ paddingTop: 40 }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Домашние задания</div>
                    <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
                      {activeTasks.length > 0
                        ? <>{activeTasks.length} <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-sub)' }}>активных</span></>
                        : 'Нет активных'}
                    </h2>
                  </div>
                  <button onClick={() => setShowAssign(true)} className="btn btn-primary">+ Назначить</button>
                </div>

                {/* Active tasks */}
                {activeTasks.length > 0 && (
                  <div className="section">
                    <div className="section-head">
                      <h3>В работе</h3>
                      <span className="hint">{activeTasks.length}</span>
                    </div>
                    {activeTasks.map(t => (
                      <div key={t.id} className="list-line">
                        <span style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                          border: '2px solid var(--accent)', background: 'transparent',
                          display: 'inline-block'
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="text-md" style={{ fontWeight: 600 }}>{t.text}</div>
                          {t.dueDate && (
                            <div className="text-xs faint" style={{ marginTop: 3 }}>
                              до {fmtDate(t.dueDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Done tasks */}
                {doneTasks.length > 0 && (
                  <div className="section">
                    <div className="section-head">
                      <h3 style={{ color: 'var(--text-sub)' }}>Выполнено</h3>
                      <span className="hint" style={{ color: 'var(--c-moss)' }}>{doneTasks.length}</span>
                    </div>
                    {doneTasks.map(t => (
                      <div key={t.id} className="list-line" style={{ opacity: 0.55 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                          background: 'var(--c-moss)', border: 'none',
                          display: 'grid', placeItems: 'center',
                          fontSize: 10, color: 'var(--on-accent)', fontWeight: 700
                        }}>✓</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="text-md" style={{ fontWeight: 500, textDecoration: 'line-through' }}>{t.text}</div>
                          {t.dueDate && (
                            <div className="text-xs faint" style={{ marginTop: 3 }}>до {fmtDate(t.dueDate)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {clientTasks.length === 0 && (
                  <div style={{ padding: '48px 0 24px' }}>
                    <div style={{ fontSize: 15, color: 'var(--text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
                      Нет назначенных заданий. Домашние практики помогают закрепить работу между сессиями.
                    </div>
                    <button onClick={() => setShowAssign(true)} className="btn btn-primary">
                      + Назначить первое задание
                    </button>
                  </div>
                )}

                {/* Divider + templates */}
                <hr className="hr-soft" style={{ margin: '48px 0 32px' }} />
                <div className="eyebrow" style={{ marginBottom: 20 }}>Шаблоны заданий</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[
                    { t: 'Схема-карточка', sub: 'Триггеры · чувства · мысли · корни · реальность · поведение' },
                    { t: 'Дневник режима', sub: '5–7 эпизодов, фокус на конкретном режиме' },
                    { t: 'Письмо себе', sub: 'От Здорового Взрослого к Уязвимому Ребёнку' },
                    { t: 'Imagery rescripting', sub: 'Аудио-практика, 12 минут' },
                  ].map(card => (
                    <div key={card.t} className="list-line" onClick={() => setShowAssign(true)} style={{ cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-md" style={{ fontWeight: 600 }}>{card.t}</div>
                        <div className="text-sm muted" style={{ marginTop: 3, lineHeight: 1.5 }}>{card.sub}</div>
                      </div>
                      <span className="link" style={{ flexShrink: 0 }}>назначить →</span>
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}

            {/* ── YSQ ──────────────────────────────────────────────────────────── */}
            {clientTab === 'ysq' && (
              <ClientYSQTab
                clientData={clientData}
                selectedClient={selectedClient}
                selfSchemaIds={selfSchemaIds}
                ysqSchemaIds={ysqSchemaIds}
                ysqRequested={ysqRequested}
                ysqError={ysqError}
                exportCopied={exportCopied}
                handleRequestYsq={handleRequestYsq}
                handleExport={handleExport}
              />
            )}

            {/* ── OLD YSQ BODY (replaced) – keep tombstone so edit finds it */}

            {/* ── CLIENT NOTES ─────────────────────────────────────────────────── */}
            {clientTab === 'client_notes' && (
              <ClientNotesTab
                clientSchemaNotesData={clientSchemaNotesData}
                clientModeNotesData={clientModeNotesData}
                clientDiary={clientDiary}
              />
            )}

            </> /* end tabLoading ternary */}


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

