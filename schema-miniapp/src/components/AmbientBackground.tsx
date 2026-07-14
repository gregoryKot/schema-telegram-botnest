// Фоновые размытые «блобы» — цвета берутся из CSS-переменных темы.
// Перенесено из App.tsx как есть (этап 3 REMEDIATION_PLAN).
export function AmbientBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: '50%',
          top: -90,
          right: -70,
          background: 'var(--blob-1)',
          filter: 'blur(90px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '50%',
          bottom: 140,
          left: -70,
          background: 'var(--blob-2)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}
