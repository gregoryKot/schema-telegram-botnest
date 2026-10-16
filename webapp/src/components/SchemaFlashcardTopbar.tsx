// Вынесено из SchemaFlashcard.tsx (правило №10 CLAUDE.md — файл-храповик).
import { GlyphArrowLeft } from './exercises/ExScreen';

export function Topbar({ onBack, label = 'Закрыть' }: { onBack: () => void; label?: string }) {
  return (
    <div className="sk-top">
      <button className="ds-link sk-back" onClick={onBack}>
        <GlyphArrowLeft /> {label}
      </button>
    </div>
  );
}
