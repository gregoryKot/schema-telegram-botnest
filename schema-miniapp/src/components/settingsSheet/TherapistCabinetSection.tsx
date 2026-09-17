import { useState } from 'react';
import { api } from '../../api';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
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
  const [inviteError, setInviteError] = useState(false);
  const { failed: inviteCopyFailed, copy: copyInviteUrl } =
    useCopyToClipboard();
  return (
    <div className="u-mb8">
      <SettingsLabel>КАБИНЕТ ТЕРАПЕВТА</SettingsLabel>
      <div className="card u-r16-clip">
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
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)' }}
            >
              Открыть кабинет
            </div>
            <div className="u-faint12-mt2">Клиенты, задания, приглашения</div>
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
                setInviteError(false);
                await copyInviteUrl(url);
              } catch (e) {
                console.error('createTherapyInvite', e);
                setInviteError(true);
              }
            }}
            style={{
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              borderRadius: 'var(--r-10)',
              padding: '8px 16px',
              color: 'var(--accent)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {inviteError ? 'Не получилось' : '+ Создать приглашение клиенту'}
          </button>
          {therapyInviteUrl && (
            <div
              style={{
                fontSize: 12,
                color: inviteCopyFailed
                  ? 'var(--accent-red)'
                  : 'var(--text-sub)',
                marginTop: 8,
                wordBreak: 'break-all',
              }}
            >
              {inviteCopyFailed ? 'Не скопировалось: ' : 'Скопировано: '}
              {therapyInviteUrl.slice(0, 50)}...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
