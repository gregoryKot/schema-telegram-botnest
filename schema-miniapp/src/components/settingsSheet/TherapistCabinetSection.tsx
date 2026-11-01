import { useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { InviteCodeBox } from '../../../../shared/src/therapy/InviteCodeBox';
import { inviteCreateErrorText } from '../../../../shared/src/therapy/therapyInvites';
import { SettingsLabel } from './ui';

interface Props {
  onOpenTherapistCabinet?: () => void;
}

// «Кабинет терапевта» в настройках мини-аппа: вход в кабинет и быстрое
// приглашение. Инцидент 2026-10-26: каждый тап — новый код (раньше тот же, и
// второй клиент получал ссылку первого), код виден отдельно от ссылки.
export function TherapistCabinetSection({ onOpenTherapistCabinet }: Props) {
  const tr = useTr();
  const [invite, setInvite] = useState<{ url: string; code: string } | null>(
    null,
  );
  const [inviteError, setInviteError] = useState('');
  const {
    copied: inviteCopied,
    failed: inviteCopyFailed,
    copy: copyInviteUrl,
  } = useCopyToClipboard();
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
                const created = await api.createTherapyInvite();
                setInvite(created);
                setInviteError('');
                await copyInviteUrl(created.url);
              } catch (e) {
                console.error('createTherapyInvite', e);
                setInviteError(inviteCreateErrorText(e, tr));
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
            + Создать приглашение клиенту
          </button>
          {inviteError && (
            <div
              role="alert"
              style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}
            >
              {inviteError}
            </div>
          )}
          {invite && (
            <>
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
                {inviteCopyFailed
                  ? 'Ссылка не скопировалась: '
                  : inviteCopied
                    ? 'Ссылка скопирована: '
                    : 'Ссылка: '}
                {invite.url}
              </div>
              <InviteCodeBox code={invite.code} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
