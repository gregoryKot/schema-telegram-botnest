import { TherapyClientSummary } from '../../api';
import { ClientDetail } from './types';

// Имя клиента в шапке карточки: просмотр ↔ переименование (alias) + удаление.
// Вынесено из ClientDetailView (правило №10 — файл-храповик).
export function ClientNameHeader({
  selectedClient,
  detail,
  aliasInputRef,
}: {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
  aliasInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const {
    renamingAlias,
    setRenamingAlias,
    aliasInput,
    setAliasInput,
    aliasSaving,
    aliasError,
    setAliasError,
    saveAlias,
    deleteClient,
    deleteLoading,
  } = detail;

  if (renamingAlias) {
    return (
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
    );
  }

  return (
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
        style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', flexShrink: 0 }}
        title="Удалить клиента"
        aria-label="Удалить"
      >
        {/* prettier-ignore */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </div>
  );
}
