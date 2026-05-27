import { useHistorySheet } from '../hooks/useHistorySheet';
import { ErrorBoundary } from './ErrorBoundary';
import { DiarySection } from '../sections/DiarySection';

export function DiariesOverlay({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
      <ErrorBoundary section="Дневник" key="diary-overlay-boundary">
        <DiarySection onClose={goBack} />
      </ErrorBoundary>
    </div>
  );
}
