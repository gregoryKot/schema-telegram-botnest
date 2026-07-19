// Липкая шапка дневниковой формы (заголовок + подзаголовок + кнопка
// "Сохранить") — общая для ModeEntrySheet и SchemaEntrySheet
// (правило №11 CLAUDE.md, jscpd-свип 2026-07).
export function DiaryStickyHeader({
  title,
  subtitle,
  color,
  canSave,
  saving,
  onSave,
}: {
  title: string;
  subtitle: string;
  color: string;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--sheet-bg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 4,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(var(--fg-rgb),0.06)',
        marginBottom: 8,
      }}
    >
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{subtitle}</div>
      </div>
      <button
        onClick={onSave}
        disabled={!canSave || saving}
        style={{
          padding: '9px 18px',
          borderRadius: 12,
          border: 'none',
          background: canSave ? color : 'rgba(var(--fg-rgb),0.08)',
          color: canSave ? '#fff' : 'rgba(var(--fg-rgb),0.25)',
          fontSize: 13,
          fontWeight: 600,
          cursor: canSave ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        {saving ? 'Сохраняю...' : 'Сохранить'}
      </button>
    </div>
  );
}
