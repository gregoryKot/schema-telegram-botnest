import { api } from '../../api';

export function NameSection({
  editName,
  setEditName,
  displayName,
  tgName,
  nameSaving,
  setNameSaving,
  onNameChanged,
  showSavedToast,
}: {
  editName: string;
  setEditName: (v: string) => void;
  displayName?: string | null;
  tgName: string;
  nameSaving: boolean;
  setNameSaving: (v: boolean) => void;
  onNameChanged?: (name: string) => void;
  showSavedToast: () => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-sub)',
          marginBottom: 10,
          paddingTop: 6,
        }}
      >
        КАК ТЕБЯ ЗОВУТ
      </div>
      <div
        className="card"
        style={{
          borderRadius: 16,
          padding: '12px 16px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Твоё имя"
          maxLength={50}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
        {editName !== (displayName ?? tgName) && (
          <button
            disabled={nameSaving || !editName.trim()}
            onClick={async () => {
              const name = editName.trim();
              if (!name) return;
              setNameSaving(true);
              try {
                await api.updateName(name);
                onNameChanged?.(name);
                showSavedToast();
              } catch {
                /* игнорируем */
              } finally {
                setNameSaving(false);
              }
            }}
            style={{
              background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
              border: 'none',
              borderRadius: 10,
              padding: '6px 14px',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {nameSaving ? '...' : 'Сохранить'}
          </button>
        )}
      </div>
      {tgName && editName !== tgName && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            marginTop: 4,
            padding: '0 4px',
          }}
        >
          В Telegram: {tgName}
        </div>
      )}
    </div>
  );
}
