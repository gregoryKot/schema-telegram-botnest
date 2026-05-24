export function Loader({ minHeight }: { minHeight?: string }) {
  // Use fixed overlay for full-screen loads (100vh / 100dvh) so the spinner
  // is always centred regardless of the parent's flex direction.
  const fullScreen = minHeight && (minHeight.includes('100vh') || minHeight.includes('100dvh'));

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
        zIndex: 9999,
      }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', flex: 1,
      minHeight: minHeight ?? '60vh',
    }}>
      <div className="spinner" />
    </div>
  );
}
