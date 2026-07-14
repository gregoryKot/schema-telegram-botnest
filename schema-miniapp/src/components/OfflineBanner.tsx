// Баннер «Нет подключения» поверх всего приложения. Перенесено из App.tsx
// как есть (этап 3 REMEDIATION_PLAN).
export function OfflineBanner({ isOffline }: { isOffline: boolean }) {
  if (!isOffline) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        background: 'rgba(239,68,68,0.92)',
        backdropFilter: 'blur(8px)',
        padding: '10px 20px',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text)',
      }}
    >
      Нет подключения — данные не сохраняются
    </div>
  );
}
