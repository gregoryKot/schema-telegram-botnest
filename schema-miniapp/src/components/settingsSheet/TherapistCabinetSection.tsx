import { useState } from 'react';
import { api } from '../../api';
import { SettingsLabel } from './primitives';

export function TherapistCabinetSection({
  onOpenTherapistCabinet,
  therapyInviteUrl,
  setTherapyInviteUrl,
  onResignTherapist,
}: {
  onOpenTherapistCabinet?: () => void;
  therapyInviteUrl: string;
  setTherapyInviteUrl: (v: string) => void;
  onResignTherapist?: () => Promise<void> | void;
}) {
  const [resignConfirm, setResignConfirm] = useState(false);
  const [resignBusy, setResignBusy] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>КАБИНЕТ ТЕРАПЕВТА</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div
          onClick={onOpenTherapistCabinet}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenTherapistCabinet?.();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            cursor: 'pointer',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--accent)',
              }}
            >
              Открыть кабинет
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-faint)',
                marginTop: 2,
              }}
            >
              Клиенты, задания, приглашения
            </div>
          </div>
          <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
        </div>
        <div
          style={{
            borderTop: '1px solid rgba(var(--fg-rgb),0.05)',
            padding: '12px 16px',
          }}
        >
          <button
            onClick={async () => {
              try {
                const { url } = await api.createTherapyInvite();
                setTherapyInviteUrl(url);
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  /* ignore */
                }
              } catch {
                /* ignore */
              }
            }}
            style={{
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              borderRadius: 10,
              padding: '8px 16px',
              color: 'var(--accent)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            + Создать приглашение клиенту
          </button>
          {therapyInviteUrl && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-sub)',
                marginTop: 8,
                wordBreak: 'break-all',
              }}
            >
              Скопировано: {therapyInviteUrl.slice(0, 50)}...
            </div>
          )}
        </div>
        {onResignTherapist && (
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
