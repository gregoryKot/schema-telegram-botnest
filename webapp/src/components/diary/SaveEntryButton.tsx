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
      className="ds-btn"
      disabled={!canSave || saving}
      onClick={onSave}
    >
      {saving ? 'Сохраняю…' : 'Сохранить запись'}
      {!saving && <GlyphCheck />}
    </button>
  );
}
