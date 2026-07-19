import { pressable } from '../../utils/a11y';
import { TherapyClientSummary } from '../../api';
import { SessionCard } from './SessionCard';
import { ClinicalSnapshot } from './ClinicalSnapshot';
import { ActionButtons } from './ActionButtons';
import { ClientDetail } from './types';

interface ClientDetailViewProps {
  selectedClient: TherapyClientSummary;
  today: string;
  safeTop: number;
  animKey: number;
  switchView: (v: 'list' | 'client') => void;
  detail: ClientDetail;
  aliasInputRef: React.RefObject<HTMLInputElement | null>;
  startDateInputRef: React.RefObject<HTMLInputElement | null>;
  nextSessionInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ClientDetailView({
  selectedClient,
  today,
  safeTop,
  animKey,
  switchView,
  detail,
  aliasInputRef,
  startDateInputRef,
  nextSessionInputRef,
}: ClientDetailViewProps) {
  const {
    renamingAlias,
    setRenamingAlias,
    aliasInput,
    setAliasInput,
    aliasSaving,
    aliasError,
    setAliasError,
    saveAlias,
    setYsqRequested,
    deleteClient,
    deleteLoading,
    deleteError,
  } = detail;

  return (
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
      {/* ── STICKY HEADER ── */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: safeTop + 8,
          padding: `${safeTop + 8}px 20px 0`,
          background: 'var(--bg)',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          {/* Back button — large touch target */}
          <div
            {...pressable(() => {
              switchView('list');
              setRenamingAlias(false);
              setYsqRequested(false);
            })}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
              marginLeft: -8,
            }}
          >
            <span
              style={{
                fontSize: 26,
                color: 'var(--text-sub)',
                lineHeight: 1,
              }}
            >
              ‹
            </span>
          </div>

          {/* Name / rename */}
          {renamingAlias ? (
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={aliasInputRef}
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveAlias()}
                  placeholder={selectedClient.name ?? 'Имя'}
                  maxLength={100}
                  style={{
                    flex: 1,
                    background: 'rgba(var(--fg-rgb),0.07)',
                    border: '1px solid rgba(var(--fg-rgb),0.15)',
                    borderRadius: 10,
                    padding: '7px 10px',
                    outline: 'none',
                    color: 'var(--text)',
                    fontSize: 15,
                  }}
                />
                <button
                  onClick={saveAlias}
                  disabled={aliasSaving}
                  aria-label="Сохранить"
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {aliasSaving ? '...' : '✓'}
                </button>
                <button
                  onClick={() => {
                    setRenamingAlias(false);
                    setAliasError('');
                  }}
                  aria-label="Отменить"
                  style={{
                    padding: '7px 10px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'rgba(var(--fg-rgb),0.07)',
                    color: 'var(--text-sub)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
              {aliasError && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--accent-red)',
                    marginTop: 4,
                  }}
                >
                  {aliasError}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: 'var(--text)',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedClient.clientAlias ?? selectedClient.name ?? 'Клиент'}
              </div>
              <button
                onClick={() => {
                  setAliasInput(
                    selectedClient.clientAlias ?? selectedClient.name ?? '',
                  );
                  setRenamingAlias(true);
                }}
                aria-label="Переименовать"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: 'var(--text-faint)',
                  padding: '4px',
                  flexShrink: 0,
                }}
              >
                ✎
              </button>
              <button
                onClick={deleteClient}
                disabled={deleteLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  color: 'var(--accent-red)',
                  padding: '4px',
                  flexShrink: 0,
                }}
                title="Удалить клиента"
                aria-label="Удалить клиента"
              >
                🗑
              </button>
            </div>
          )}
        </div>

        {/* Delete error */}
        {deleteError && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent-red)',
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            {deleteError}
          </div>
        )}

        {/* Thin separator */}
        <div
          style={{
            height: 1,
            background: 'rgba(var(--fg-rgb),0.06)',
            margin: '10px -20px 0',
          }}
        />
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto' as const,
          padding: '12px 20px 100px',
        }}
      >
        {/* ── SESSION CARD ── */}
        <SessionCard
          selectedClient={selectedClient}
          today={today}
          detail={detail}
          startDateInputRef={startDateInputRef}
          nextSessionInputRef={nextSessionInputRef}
        />

        {/* ── CLINICAL SNAPSHOT ── */}
        <ClinicalSnapshot detail={detail} />

        {/* ── ACTION BUTTONS ── */}
        <ActionButtons detail={detail} />
      </div>
    </div>
  );
}
