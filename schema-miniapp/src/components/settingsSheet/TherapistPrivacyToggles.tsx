import { UserSettings } from '../../api';

interface Props {
  settings: UserSettings;
  patch: (update: Partial<UserSettings>) => Promise<void>;
}

export function TherapistPrivacyToggles({ settings, patch }: Props) {
  return (
    <div
      style={{
        marginBottom: 12,
        background: 'rgba(var(--fg-rgb),0.04)',
        borderRadius: 'var(--r-12)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '11px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(var(--fg-rgb),0.06)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text)',
              fontWeight: 500,
            }}
          >
            Карточки схем и режимов
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-sub)',
              marginTop: 1,
            }}
          >
            Личные карточки и заметки
          </div>
        </div>
        <div
          onClick={() =>
            patch({
              therapistShareCards: !settings.therapistShareCards,
            })
          }
          role="switch"
          aria-checked={!!settings.therapistShareCards}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              void patch({
                therapistShareCards: !settings.therapistShareCards,
              });
            }
          }}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            background: settings.therapistShareCards
              ? 'var(--accent)'
              : 'rgba(var(--fg-rgb),0.15)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: settings.therapistShareCards ? 20 : 2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--bg)',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      </div>
      <div
        style={{
          padding: '11px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text)',
              fontWeight: 500,
            }}
          >
            Профиль и схемы
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-sub)',
              marginTop: 1,
            }}
          >
            Активные схемы и результаты теста
          </div>
        </div>
        <div
          onClick={() =>
            patch({
              therapistShareProfile: !settings.therapistShareProfile,
            })
          }
          role="switch"
          aria-checked={!!settings.therapistShareProfile}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              void patch({
                therapistShareProfile: !settings.therapistShareProfile,
              });
            }
          }}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            background: settings.therapistShareProfile
              ? 'var(--accent)'
              : 'rgba(var(--fg-rgb),0.15)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: settings.therapistShareProfile ? 20 : 2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--bg)',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
