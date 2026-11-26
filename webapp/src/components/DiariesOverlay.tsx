import { useHistorySheet } from '../hooks/useHistorySheet';
import { ErrorBoundary } from './ErrorBoundary';
import { DiarySection } from '../sections/DiarySection';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { ExBar } from './exercises/ExBar';
// Лист «Дневники» поверх задания и практик: «Назад» шапкой листа (ExBar, goBack; до b11 — только системным «назад»).
export function DiariesOverlay({ onClose, onOpenTrackerHistory }: { onClose: () => void; onOpenTrackerHistory?: () => void }) {
  const goBack = useHistorySheet(onClose);
  const dialogA11y = useDialogA11y();
  return (
    <div {...dialogA11y} className="u-sheet-grid">
      <ExBar onBack={goBack} label="Назад" />
      <div className="cd-sheet-scroll"><ErrorBoundary section="Дневник" key="diary-overlay-boundary"><DiarySection onOpenTrackerHistory={onOpenTrackerHistory} /></ErrorBoundary></div>
    </div>
  );
}
