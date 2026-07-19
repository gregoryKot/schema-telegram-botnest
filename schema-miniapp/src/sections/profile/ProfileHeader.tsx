interface ProfileHeaderProps {
  firstName: string;
  totalDays: number;
  onOpenSettings: () => void;
}

export function ProfileHeader({
  firstName,
  totalDays,
  onOpenSettings,
}: ProfileHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 20px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            flexShrink: 0,
            background:
              'linear-gradient(135deg, var(--accent), var(--accent-blue))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          {(firstName || 'Я')[0].toUpperCase()}
        </div>
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.4px',
            }}
          >
            {firstName || 'Я'}
          </div>
          {totalDays > 0 && (
            <div
              style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 1 }}
            >
              {totalDays}{' '}
              {totalDays === 1 ? 'день' : totalDays < 5 ? 'дня' : 'дней'} в
              приложении
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onOpenSettings}
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: 'none',
          background: 'rgba(var(--fg-rgb),0.06)',
          color: 'var(--text-sub)',
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ⚙️
      </button>
    </div>
  );
}
