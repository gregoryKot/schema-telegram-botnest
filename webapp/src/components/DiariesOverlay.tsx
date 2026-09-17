import { useHistorySheet } from '../hooks/useHistorySheet';
import { ErrorBoundary } from './ErrorBoundary';
import { DiarySection } from '../sections/DiarySection';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';

export function DiariesOverlay({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  const dialogA11y = useDialogA11y();
  return (
    <div {...dialogA11y} className="u-sheet">
      <ErrorBoundary section="Дневник" key="diary-overlay-boundary">
        <DiarySection onClose={goBack} />
      </ErrorBoundary>
    </div>
  );
}
