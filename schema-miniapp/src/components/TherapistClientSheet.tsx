import { useEffect, useState } from 'react';
import { useTr } from '../utils/addressForm';
import { api, TherapyClientSummary } from '../api';
import { TaskCreateSheet } from './TaskCreateSheet';
import { todayStr } from '../utils/format';
import { useSafeTop } from '../utils/safezone';
import { useClientDetail } from './therapist/useClientDetail';
import { useAddClient } from './therapist/useAddClient';
import { ClientListView } from './therapistClientSheet/ClientListView';
import { ClientDetailHeader } from './therapistClientSheet/ClientDetailHeader';
import { SessionCard } from './therapistClientSheet/SessionCard';
import { ClinicalSnapshot } from './therapistClientSheet/ClinicalSnapshot';
import { ClientActionButtons } from './therapistClientSheet/ClientActionButtons';
import { TasksSheet } from './therapistClientSheet/TasksSheet';
import { NotesSheet } from './therapistClientSheet/NotesSheet';
import { ConceptSheet } from './therapistClientSheet/ConceptSheet';
import { ClientNotesSheet } from './therapistClientSheet/ClientNotesSheet';

interface Props {
  view: 'list' | 'client';
  onViewChange: (v: 'list' | 'client') => void;
  onClose: () => void;
  backHandlerRef?: React.MutableRefObject<() => void>;
}

export function TherapistClientSheet({
  view,
  onViewChange,
  onClose,
  backHandlerRef,
}: Props) {
  const tr = useTr();
  const safeTop = useSafeTop();

  // Client list
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Animation key — changes when view transitions to trigger CSS animation
  const [animKey, setAnimKey] = useState(0);

  function switchView(v: 'list' | 'client') {
    setAnimKey((k) => k + 1);
    onViewChange(v);
  }

  // ─── Hooks ────────────────────────────────────────────────────────────────────
  const detail = useClientDetail({ switchView, setClients });
  const addClient = useAddClient({ setClients });

  useEffect(() => {
    api
      .getTherapyClients()
      .then(setClients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ─── Back button handler (keeps Telegram back button working for sheets) ─────
  useEffect(() => {
    if (!backHandlerRef || view !== 'client') return;
    backHandlerRef.current = () => {
      if (detail.showAssign) {
        detail.setShowAssign(false);
        return;
      }
      if (detail.showConceptSheet) {
        detail.setShowConceptSheet(false);
        return;
      }
      if (detail.showTasksSheet) {
        detail.setShowTasksSheet(false);
        return;
      }
      if (detail.showNotesSheet) {
        detail.setShowNotesSheet(false);
        return;
      }
      if (detail.showClientNotesSheet) {
        detail.setShowClientNotesSheet(false);
        return;
      }
      switchView('list');
    };
  }, [
    view,
    detail.showAssign,
    detail.showConceptSheet,
    detail.showTasksSheet,
    detail.showNotesSheet,
    detail.showClientNotesSheet,
    backHandlerRef,
  ]);

  // ─── Destructure for JSX convenience ─────────────────────────────────────────
  const {
    selectedClient,
    showTasksSheet,
    showNotesSheet,
    showConceptSheet,
    showClientNotesSheet,
    setClientTasks,
    showAssign,
    setShowAssign,
    openClient,
  } = detail;

  const today = todayStr();

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── LIST VIEW ─────────────────────────────────────────────── */}
      {view === 'list' && (
        <ClientListView
          safeTop={safeTop}
          animKey={animKey}
          onClose={onClose}
          loading={loading}
          clients={clients}
          today={today}
          tr={tr}
          openClient={openClient}
          addClient={addClient}
        />
      )}

      {/* ── CLIENT VIEW ───────────────────────────────────────────── */}
      {view === 'client' && selectedClient && (
        <div
          key={`client-${animKey}`}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fade-in 0.22s ease',
          }}
        >
          <ClientDetailHeader
            safeTop={safeTop}
            switchView={switchView}
            selectedClient={selectedClient}
            detail={detail}
          />

          {/* ── SCROLLABLE CONTENT ── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto' as const,
              padding: '12px 20px 100px',
            }}
          >
            <SessionCard
              selectedClient={selectedClient}
              today={today}
              detail={detail}
            />
            <ClinicalSnapshot detail={detail} />
            <ClientActionButtons detail={detail} />
          </div>
        </div>
      )}

      {/* ── TASKS SHEET (outside fixed div for correct z-index) ── */}
      {showTasksSheet && selectedClient && <TasksSheet detail={detail} />}

      {/* ── NOTES SHEET (outside fixed div for correct z-index) ── */}
      {showNotesSheet && selectedClient && <NotesSheet detail={detail} />}

      {/* ── CONCEPT SHEET (outside fixed div for correct z-index) ── */}
      {showConceptSheet && selectedClient && (
        <ConceptSheet selectedClient={selectedClient} detail={detail} />
      )}

      {/* ── CLIENT NOTES SHEET ── */}
      {showClientNotesSheet && selectedClient && (
        <ClientNotesSheet detail={detail} />
      )}

      {showAssign && selectedClient && (
        <TaskCreateSheet
          clientId={selectedClient.telegramId}
          clientName={selectedClient.name ?? undefined}
          onCreated={async () => {
            setShowAssign(false);
            const tasks = await api
              .getTherapyTasksForClient(selectedClient.telegramId)
              .catch(() => []);
            setClientTasks(tasks);
          }}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}
