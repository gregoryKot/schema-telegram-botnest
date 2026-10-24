import '../styles/sheet-tasks.css';

export function Loader({ minHeight }: { minHeight?: string }) {
  // Use fixed overlay for full-screen loads (100vh / 100dvh) so the spinner
  // is always centred regardless of the parent's flex direction.
  const fullScreen = minHeight && (minHeight.includes('100vh') || minHeight.includes('100dvh'));

  if (fullScreen) {
    return (
      <div className="sk-loader sk-loader--full">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="sk-loader" style={{ minHeight: minHeight ?? '60vh' }}>
      <div className="spinner" />
    </div>
  );
}
