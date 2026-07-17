import { SaveEntryButton } from './SaveEntryButton';

// Подвал формы записи с индикатором автосохранения — общий для
// ModeEntrySheet/SchemaEntrySheet (правило №11 CLAUDE.md, jscpd-свип 2026-07).
export function DiaryAutosaveFooter({
  canSave,
  saving,
  onSave,
}: {
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="ex-foot">
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-faint)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            borderRadius: 3,
            background: 'var(--c-moss)',
          }}
        />
        Автосохранение
      </span>
      <span className="spacer" />
      <SaveEntryButton canSave={canSave} saving={saving} onSave={onSave} />
    </div>
  );
}
