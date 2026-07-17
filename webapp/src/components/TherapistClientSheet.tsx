import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TherapyClientSummary, UserTask } from '../api';
import { TaskCreateSheet } from './TaskCreateSheet';
import { todayStr } from '../utils/format';
import { ClientNotesTab } from './therapist/ClientNotesTab';
import { ClientYSQTab } from './therapist/ClientYSQTab';
import { useClientDetail } from './therapist/useClientDetail';
import { useAddClient } from './therapist/useAddClient';
import { ModeMapSelector } from './ModeMapSelector';
import { ClientListView } from './therapist/ClientListView';
import { ClientOverviewTab } from './therapist/ClientOverviewTab';
import { ClientConceptTab } from './therapist/ClientConceptTab';
import { ClientSessionsTab } from './therapist/ClientSessionsTab';
import { ClientTasksTab } from './therapist/ClientTasksTab';
import { calcTherapyDuration, nextSessionLabel } from './therapist/sheetHelpers';
import type { ClientTab } from './therapist/sheetHelpers';

interface Props {
  view: 'list' | 'client';
  openClientId?: number | null;
  onViewChange: (v: 'list' | 'client') => void;
  onOpenClient?: (id: number) => void;
  onClose: () => void;
  backHandlerRef?: React.MutableRefObject<() => void>;
  onClientsChange?: (clients: TherapyClientSummary[]) => void;
}

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
    clientTasks, setClientTasks, notes,
    clientData, clientDiary,
    showAssign, setShowAssign,
    renamingAlias, setRenamingAlias, aliasInput, setAliasInput,
    aliasSaving, aliasError,
    ysqRequested, ysqError, exportCopied,
    deleteLoading, deleteError, tabLoading, clientTab, setClientTab,
    ysqSchemaIds, selfSchemaIds,
    deleteClient, saveAlias, handleRequestYsq, handleExport,
  } = detail;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="therapist-sheet" style={{ background: 'var(--bg)' }}>

      {/* ── LIST VIEW ──────────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <ClientListView
          clients={clients}
          loading={loading}
          listTab={listTab}
          setListTab={setListTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          allTasks={allTasks}
          allTasksLoading={allTasksLoading}
          setAllTasks={setAllTasks}
          setAllTasksLoading={setAllTasksLoading}
          animKey={animKey}
          openClient={detail.openClient}
          add={addClient}
        />
      )}

      {/* ── CLIENT VIEW ────────────────────────────────────────────────────────── */}
      {view === 'client' && selectedClient && (
        <div className="therapist-scroll therapist-scroll--client" key={`client-${animKey}`} style={{ animation: 'fade-in 0.22s ease' }}>

          {/* Client header — moderately compact */}
          <div className="therapist-client-header" style={{ borderBottom: '1px solid var(--line)', padding: '24px 48px 0', flexShrink: 0 }}>
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
                  <button onClick={() => setRenamingAlias(false)} aria-label="Отменить" style={{ padding: '3px 7px', borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                  {aliasError && <span style={{ fontSize: 12, color: 'var(--c-rose)' }}>{aliasError}</span>}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 380 }}>
                    {selectedClient.clientAlias ?? selectedClient.name ?? `ID ${selectedClient.telegramId}`}
                  </span>
                  <button onClick={() => { setRenamingAlias(true); setAliasInput(selectedClient.clientAlias ?? selectedClient.name ?? ''); }}
                    style={{ background: 'none', border: 'none', padding: '2px 5px', borderRadius: 4, color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }} title="Переименовать" aria-label="Переименовать">✎</button>
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
                <button onClick={deleteClient} disabled={deleteLoading} title="Удалить клиента" aria-label="Удалить клиента"
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
                ['ysq', 'Схемы', clientData?.ysqHistory?.length ?? 0],
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
          <div className="therapist-scroll therapist-scroll--tabs" key={clientTab}>

            {/* Loading state */}
            {tabLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
                <div className="spinner" />
              </div>
            ) : <>

            {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
            {clientTab === 'overview' && <ClientOverviewTab detail={detail} />}

            {/* ── CONCEPT ──────────────────────────────────────────────────────── */}
            {clientTab === 'concept' && <ClientConceptTab detail={detail} />}

            {/* ── MODE MAP — keep mounted to preserve React Flow state across tab switches */}
            {selectedClient != null && clientTab === 'mode_map' && (
              <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <ModeMapSelector key={selectedClient.telegramId} clientId={selectedClient.telegramId} />
              </div>
            )}

            {/* ── SESSIONS ─────────────────────────────────────────────────────── */}
            {clientTab === 'sessions' && <ClientSessionsTab detail={detail} />}

            {/* ── TASKS ────────────────────────────────────────────────────────── */}
            {clientTab === 'tasks' && <ClientTasksTab detail={detail} />}

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
