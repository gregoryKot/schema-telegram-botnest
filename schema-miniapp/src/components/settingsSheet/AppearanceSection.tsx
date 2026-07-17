import { resetToSystemTheme, toggleTheme, Theme } from '../../utils/theme';

export function AppearanceSection({
  theme,
  setTheme,
  userRole,
  therapistMode,
  onToggleTherapistMode,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  therapistMode?: boolean;
  onToggleTherapistMode?: () => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-sub)',
          marginBottom: 10,
          paddingTop: 6,
        }}
      >
        ОФОРМЛЕНИЕ
      </div>
      <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>
              {theme === 'dark' ? '🌙' : '☀️'}
            </span>
            <div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text)',
                  fontWeight: 500,
                }}
              >
                {theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
              </div>
              <div
                onClick={() => setTheme(resetToSystemTheme())}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTheme(resetToSystemTheme());
                  }
                }}
                style={{
                  fontSize: 11,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  marginTop: 1,
                }}
              >
                Авто (по Telegram) →
              </div>
            </div>
          </div>
          <div
            onClick={() => setTheme(toggleTheme())}
            role="switch"
            aria-checked={theme === 'light'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setTheme(toggleTheme());
              }
            }}
            style={{
              width: 46,
              height: 26,
              borderRadius: 13,
              background:
                theme === 'light'
                  ? 'var(--accent)'
                  : 'color-mix(in srgb, var(--accent) 30%, transparent)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: theme === 'light' ? 23 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'var(--bg)',
                transition: 'left 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        </div>
        {userRole === 'THERAPIST' && onToggleTherapistMode && (
          <div
            style={{
              borderTop: '1px solid rgba(var(--fg-rgb),0.06)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>👨‍⚕️</span>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--text)',
                    fontWeight: 500,
                  }}
                >
                  Режим специалиста
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-sub)',
                    marginTop: 1,
                  }}
                >
                  {therapistMode ? 'Кабинет терапевта' : 'Режим клиента'}
                </div>
              </div>
            </div>
            <div
              onClick={onToggleTherapistMode}
              role="switch"
              aria-checked={!!therapistMode}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleTherapistMode();
                }
              }}
              style={{
                width: 46,
                height: 26,
                borderRadius: 13,
                background: therapistMode
                  ? 'var(--accent)'
                  : 'color-mix(in srgb, var(--accent) 30%, transparent)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: therapistMode ? 23 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--bg)',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
