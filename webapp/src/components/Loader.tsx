export function Loader({ minHeight = '60vh' }: { minHeight?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight,
    }}>
      <div className="spinner" />
    </div>
  );
}
