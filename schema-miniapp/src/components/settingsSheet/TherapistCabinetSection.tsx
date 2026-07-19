import { api } from '../../api';
import { SettingsLabel } from './ui';

interface Props {
  onOpenTherapistCabinet?: () => void;
  therapyInviteUrl: string;
  setTherapyInviteUrl: (v: string) => void;
}

export function TherapistCabinetSection({
  onOpenTherapistCabinet,
  therapyInviteUrl,
  setTherapyInviteUrl,
}: Props) {
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
      </div>
    </div>
  );
}
