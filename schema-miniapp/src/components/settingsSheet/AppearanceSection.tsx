// Секция «Оформление» — тема (свет/тьма/системная) + reduced motion.
// Вынесено из SettingsSheet.tsx.
import { useState } from 'react';
import { toggleTheme, resetToSystemTheme } from '../../utils/theme';
import type { Theme } from '../../utils/theme';
import type { useReducedMotionPref } from '../../hooks/useReducedMotionPref';
import { SettingsLabel, Row, Toggle } from './primitives';

export function AppearanceSection({
  theme,
  setTheme,
  motion,
  userRole,
  therapistMode,
  onToggleTherapistMode,
  onResignTherapist,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  motion: ReturnType<typeof useReducedMotionPref>;
  userRole?: 'CLIENT' | 'THERAPIST';
  therapistMode?: boolean;
  onToggleTherapistMode?: () => void;
  onResignTherapist?: () => Promise<void> | void;
}) {
  const [resignConfirm, setResignConfirm] = useState(false);
  const [resignBusy, setResignBusy] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ОФОРМЛЕНИЕ</SettingsLabel>
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
        {/* Нейроинклюзивность: сниженная анимация (WCAG 2.3.3) */}
        <Row
          label="Меньше движения"
          sub={motion.sub}
          divider
          right={<Toggle on={motion.reduced} onClick={motion.toggle} />}
        />
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
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
        {userRole === 'THERAPIST' && onResignTherapist && (
          <div
            style={{
              borderTop: '1px solid rgba(var(--fg-rgb),0.06)',
              padding: '14px 16px',
            }}
          >
            {!resignConfirm ? (
              <button
                onClick={() => setResignConfirm(true)}
                style={{
                  width: '100%',
                  padding: '9px 0',
                  borderRadius: 10,
                  border: '1px solid rgba(var(--fg-rgb),0.1)',
                  background: 'transparent',
                  color: 'var(--text-sub)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Перестать быть специалистом
              </button>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-sub)',
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}
                >
                  Роль специалиста будет снята: кабинет и доступ к данным
                  клиентов пропадут. Свои данные не теряешь. Заявку можно подать
                  заново.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    disabled={resignBusy}
                    onClick={() => setResignConfirm(false)}
                    style={{
                      flex: 1,
                      padding: '9px 0',
                      borderRadius: 10,
                      border: '1px solid rgba(var(--fg-rgb),0.1)',
                      background: 'transparent',
                      color: 'var(--text-sub)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    disabled={resignBusy}
                    onClick={() => {
                      setResignBusy(true);
                      void (async () => {
                        try {
                          await onResignTherapist();
                          setResignConfirm(false);
                        } finally {
                          setResignBusy(false);
                        }
                      })();
                    }}
                    style={{
                      flex: 1,
                      padding: '9px 0',
                      borderRadius: 10,
                      border: 'none',
                      background: 'var(--accent-red)',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {resignBusy ? '...' : 'Снять роль'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
