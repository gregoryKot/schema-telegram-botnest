import { GlyphCheck } from '../exercises/ExScreen';

// Кнопка "Сохранить запись" дневниковой формы — общая для
// ModeEntrySheet/SchemaEntrySheet/GratitudeEntrySheet
// (правило №11 CLAUDE.md, jscpd-свип 2026-07).
export function SaveEntryButton({
  canSave,
  saving,
  onSave,
}: {
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <button
      className="ex-btn ex-btn-primary"
      disabled={!canSave || saving}
      onClick={onSave}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      {saving ? 'Сохраняю…' : 'Сохранить запись'}
      {!saving && <GlyphCheck />}
    </button>
  );
}
