import { useState } from 'react';
import { useTr } from '../utils/addressForm';
import { useCopyToClipboard } from '../utils/useCopyToClipboard';
import { CopyFailedHint } from '../components/CopyFailedHint';
import { inviteButtonStyle, inviteCodeStyle } from './InviteCodeBox';
import type { TherapyInvite } from './therapyInvites';

// Строка блока «Ждут подключения» (PendingInvitesList): кто приглашён, код,
// до какого дня он действует, копирование кода и ссылки, отзыв с
// подтверждением прямо в строке — отозванный код перестаёт работать, и
// случайный тап по нему не должен ломать приглашение, отправленное клиенту.
const muted = { fontSize: 12, color: 'var(--text-sub)' } as const;

/** Момент окончания — в зоне читателя (правило №25): «до 2 ноября». */
export function inviteExpiryLabel(expiresAt: string): string {
  const day = new Date(expiresAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  return `действует до ${day}`;
}

export function PendingInviteRow({
  invite,
  onRevoke,
  revokeFailed,
}: {
  invite: TherapyInvite;
  onRevoke: () => void;
  revokeFailed: boolean;
}) {
  const tr = useTr();
  const [confirming, setConfirming] = useState(false);
  const code = useCopyToClipboard();
  const link = useCopyToClipboard();
  return (
    <li
      style={{
        listStyle: 'none',
        padding: '12px 0',
        borderTop: '1px solid rgba(var(--fg-rgb),0.08)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
        {invite.alias ?? 'Приглашение без имени'}
      </div>
      <div style={{ ...muted, marginTop: 2 }}>
        <code style={{ ...inviteCodeStyle, fontSize: 13 }}>{invite.code}</code>
        {' · '}
        {inviteExpiryLabel(invite.expiresAt)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {confirming ? (
          <>
            <span style={{ ...muted, alignSelf: 'center' }}>
              Код перестанет действовать.
            </span>
            <button
              type="button"
              style={{ ...inviteButtonStyle, color: 'var(--accent-red)' }}
              onClick={() => {
                setConfirming(false);
                onRevoke();
              }}
            >
              Отозвать
            </button>
            <button
              type="button"
              style={inviteButtonStyle}
              onClick={() => setConfirming(false)}
            >
              Оставить
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              style={inviteButtonStyle}
              onClick={() => void code.copy(invite.code)}
            >
              {code.copied ? '✓ Код скопирован' : 'Скопировать код'}
            </button>
            <button
              type="button"
              style={inviteButtonStyle}
              onClick={() => void link.copy(invite.url)}
            >
              {link.copied ? '✓ Ссылка скопирована' : 'Скопировать ссылку'}
            </button>
            <button
              type="button"
              style={{ ...inviteButtonStyle, background: 'transparent' }}
              onClick={() => setConfirming(true)}
            >
              Отозвать
            </button>
          </>
        )}
      </div>
      <CopyFailedHint show={code.failed || link.failed} />
      {revokeFailed && (
        <div
          role="alert"
          style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 6 }}
        >
          {tr(
            'Не удалось отозвать. Попробуй ещё раз',
            'Не удалось отозвать. Попробуйте ещё раз',
          )}
        </div>
      )}
    </li>
  );
}
