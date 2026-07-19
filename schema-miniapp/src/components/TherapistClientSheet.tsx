import { useEffect, useRef, useState } from 'react';
import { api, TherapyClientSummary } from '../api';
import { TaskCreateSheet } from './TaskCreateSheet';
import { todayStr } from '../utils/format';
import { useSafeTop } from '../utils/safezone';
import { useClientDetail } from './therapist/useClientDetail';
import { useAddClient } from './therapist/useAddClient';
import { ClientListView } from './therapistClientSheet/ClientListView';
import { ClientDetailView } from './therapistClientSheet/ClientDetailView';
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

  // ─── Destructure for JSX guards / effects ────────────────────────────────────
  const {
    selectedClient,
    showTasksSheet,
    showNotesSheet,
    showConceptSheet,
    showClientNotesSheet,
    showAssign,
    setShowAssign,
    setClientTasks,
    renamingAlias,
    editingStartDate,
    editingNextSession,
  } = detail;

  const { addMode } = addClient;

  const today = todayStr();

  // ─── Autofocus via refs (jsx-a11y/no-autofocus) ──────────────────────────────
  const telegramInputRef = useRef<HTMLInputElement>(null);
  const virtualInputRef = useRef<HTMLInputElement>(null);
  const aliasInputRef = useRef<HTMLInputElement>(null);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const nextSessionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addMode === 'telegram') telegramInputRef.current?.focus();
  }, [addMode]);
  useEffect(() => {
    if (addMode === 'virtual') virtualInputRef.current?.focus();
  }, [addMode]);
  useEffect(() => {
    if (renamingAlias) aliasInputRef.current?.focus();
  }, [renamingAlias]);
  useEffect(() => {
    if (editingStartDate) startDateInputRef.current?.focus();
  }, [editingStartDate]);
  useEffect(() => {
    if (editingNextSession) nextSessionInputRef.current?.focus();
  }, [editingNextSession]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── LIST VIEW ─────────────────────────────────────────────── */}
      {view === 'list' && (
        <ClientListView
          clients={clients}
          loading={loading}
          today={today}
          safeTop={safeTop}
          animKey={animKey}
          onClose={onClose}
          telegramInputRef={telegramInputRef}
          virtualInputRef={virtualInputRef}
          detail={detail}
          addClient={addClient}
        />
      )}

      {/* ── CLIENT VIEW ───────────────────────────────────────────── */}
      {view === 'client' && selectedClient && (
        <ClientDetailView
          selectedClient={selectedClient}
          today={today}
          safeTop={safeTop}
          animKey={animKey}
          switchView={switchView}
          detail={detail}
          aliasInputRef={aliasInputRef}
          startDateInputRef={startDateInputRef}
          nextSessionInputRef={nextSessionInputRef}
        />
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
