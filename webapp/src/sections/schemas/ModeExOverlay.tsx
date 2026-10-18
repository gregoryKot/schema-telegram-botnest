// Упражнение режима поверх «Моих паттернов» (плитки «Карта режимов»).
// Чанк упражнения грузится лениво — на экран паттернов он не нужен.
import { lazy, Suspense } from 'react';

const ModeEx = lazy(() => import('../../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));

export function ModeExOverlay({ modeId, onBack }: { modeId: string; onBack: () => void }) {
  return (
    <div className="u-sheet">
      <Suspense fallback={null}><ModeEx onBack={onBack} initialModeId={modeId} /></Suspense>
    </div>
  );
}
