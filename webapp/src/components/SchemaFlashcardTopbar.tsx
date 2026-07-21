// Вынесено из SchemaFlashcard.tsx (правило №10 CLAUDE.md — файл-храповик).
import { GlyphArrowLeft } from './exercises/ExScreen';

export function Topbar({ onBack, label = 'Закрыть' }: { onBack: () => void; label?: string }) {
  return (
    <div className="ex-topbar">
      <button className="ex-back" onClick={onBack}>
        <GlyphArrowLeft /> {label}
      </button>
    </div>
  );
}
