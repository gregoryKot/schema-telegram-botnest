// Вынесено из SchemaFlashcard.tsx (правило №10 CLAUDE.md — файл-храповик).
import { GlyphArrowLeft } from './exercises/ExScreen';

export function Topbar({ onBack, label = 'Закрыть' }: { onBack: () => void; label?: string }) {
  return (
    <div className="ds-sheet-head">
      <button type="button" className="ds-back" onClick={onBack}>
        <GlyphArrowLeft /> {label}
      </button>
    </div>
  );
}
