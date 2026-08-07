import { ProfileHeaderActions } from './ProfileHeaderActions';
interface ProfileHeaderProps {
  firstName: string;
  totalDays: number;
  onOpenSettings: () => void;
  onCustomize: () => void;
}

export function ProfileHeader({
  firstName,
  totalDays,
  onOpenSettings,
  onCustomize,
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
          <div className="d-display" style={{ fontSize: 22 }}>
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
      <ProfileHeaderActions
        onOpenSettings={onOpenSettings}
        onCustomize={onCustomize}
      />
    </div>
  );
}
