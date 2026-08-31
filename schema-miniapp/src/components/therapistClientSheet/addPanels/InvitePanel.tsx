import { TherapistInviteShare } from '../../../share/TherapistInviteShare';
import { CopyFailedHint } from '../../../../../shared/src/components/CopyFailedHint';
import { AddClient } from '../types';

// Панель «пригласить по ссылке»: генерация кода, шаринг и копирование.
// Вынесено из ClientListView.tsx (правило №10).
export function InvitePanel({ addClient }: { addClient: AddClient }) {
  const {
    inviteUrl,
    setInviteUrl,
    inviteCopied,
    inviteCopyFailed,
    inviteLoading,
    inviteInputRef,
    createInvite,
    copyInvite,
  } = addClient;
  return (
    <>
      {!inviteUrl ? (
        <button
          onClick={createInvite}
          disabled={inviteLoading}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 'var(--r-12)',
            border: 'none',
            background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: inviteLoading ? 0.6 : 1,
          }}
        >
          {inviteLoading ? 'Создаю...' : 'Создать ссылку'}
        </button>
      ) : (
        <>
          <input
            ref={inviteInputRef}
            readOnly
            value={inviteUrl}
            onClick={() => inviteInputRef.current?.select()}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: 10,
              background: 'rgba(var(--fg-rgb),0.05)',
              border: '1px solid rgba(var(--fg-rgb),0.1)',
              borderRadius: 'var(--r-10)',
              padding: '9px 12px',
              outline: 'none',
              cursor: 'text',
              color: 'var(--text-sub)',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
            <button
              onClick={copyInvite}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 'var(--r-10)',
                border: 'none',
                background: inviteCopied
                  ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)'
                  : 'rgba(var(--fg-rgb),0.07)',
                color: inviteCopied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.6)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {inviteCopied ? '✓ Скопировано' : 'Скопировать'}
            </button>
            <TherapistInviteShare inviteUrl={inviteUrl} />
          </div>
          <CopyFailedHint show={inviteCopyFailed} />
          <button
            onClick={() => setInviteUrl('')}
            style={{
              width: '100%',
              marginTop: 8,
              background: 'none',
              border: 'none',
              color: 'var(--text-faint)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            Создать новую
          </button>
        </>
      )}
    </>
  );
}
