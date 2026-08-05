import { GearIcon } from '../../components/GearIcon';
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
            className="d-display"
            style={{
              fontSize: 22,
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
        aria-label="Настройки"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: 'none',
          background: 'rgba(var(--fg-rgb),0.06)',
          color: 'var(--text-sub)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GearIcon />
      </button>
    </div>
  );
}
