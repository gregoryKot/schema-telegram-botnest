import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TherapyClientSummary, UserTask } from '../api';
import { TaskCreateSheet } from './TaskCreateSheet';
import { ClientNotesTab } from './therapist/ClientNotesTab';
import { ClientYSQTab } from './therapist/ClientYSQTab';
import { useClientDetail } from './therapist/useClientDetail';
import { useAddClient } from './therapist/useAddClient';
import { ModeMapSelector } from './ModeMapSelector';
import { ClientListView } from './therapist/ClientListView';
import { ClientHeader } from './therapist/ClientHeader';
import { ClientOverviewTab } from './therapist/ClientOverviewTab';
import { ClientConceptTab } from './therapist/ClientConceptTab';
import { ClientSessionsTab } from './therapist/ClientSessionsTab';
import { ClientTasksTab } from './therapist/ClientTasksTab';

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
    clientDiary, clientData,
    showAssign, setShowAssign, setClientTasks,
    ysqRequested, ysqError, exportCopied,
    tabLoading, clientTab,
    ysqSchemaIds, selfSchemaIds,
    handleRequestYsq, handleExport,
  } = detail;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="therapist-sheet" style={{ background: 'var(--bg)' }}>

      {/* ── LIST VIEW ──────────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <ClientListView
          animKey={animKey}
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
          openClient={detail.openClient}
          addClient={addClient}
        />
      )}

      {/* ── CLIENT VIEW ────────────────────────────────────────────────────────── */}
      {view === 'client' && selectedClient && (
        <div className="therapist-scroll therapist-scroll--client" key={`client-${animKey}`} style={{ animation: 'fade-in 0.22s ease' }}>

          {/* Client header — moderately compact */}
          <ClientHeader selectedClient={selectedClient} detail={detail} switchView={switchView} />

          {/* Tab content */}
          <div className="therapist-scroll therapist-scroll--tabs" key={clientTab}>

            {/* Loading state */}
            {tabLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
                <div className="spinner" />
              </div>
            ) : <>

            {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
            {clientTab === 'overview' && (
              <ClientOverviewTab selectedClient={selectedClient} detail={detail} />
            )}

            {/* ── CONCEPT ──────────────────────────────────────────────────────── */}
            {clientTab === 'concept' && (
              <ClientConceptTab detail={detail} />
            )}

            {/* ── MODE MAP — keep mounted to preserve React Flow state across tab switches */}
            {selectedClient != null && clientTab === 'mode_map' && (
              <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <ModeMapSelector key={selectedClient.telegramId} clientId={selectedClient.telegramId} />
              </div>
            )}

            {/* ── SESSIONS ─────────────────────────────────────────────────────── */}
            {clientTab === 'sessions' && (
              <ClientSessionsTab detail={detail} />
            )}

            {/* ── TASKS ────────────────────────────────────────────────────────── */}
            {clientTab === 'tasks' && (
              <ClientTasksTab detail={detail} />
            )}

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
