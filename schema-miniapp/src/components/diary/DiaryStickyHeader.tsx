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
        paddingBottom: 14,
        borderBottom: '1px solid var(--border-color)',
        marginBottom: 12,
      }}
    >
      <div>
        <div className="d-display" style={{ fontSize: 20 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <button
        onClick={onSave}
        disabled={!canSave || saving}
        style={{
          padding: '12px 18px',
          minHeight: 48,
          borderRadius: 'var(--r-14)',
          border: 'none',
          fontFamily: 'inherit',
          background: canSave ? color : 'var(--surface-2)',
          color: canSave ? '#fff' : 'var(--text-faint)',
          fontSize: 14,
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
