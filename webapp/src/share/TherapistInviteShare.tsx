// Кнопка «Поделиться» у ссылки-приглашения клиенту: открывает карточку
// приглашения (сама ссылка уходит текстом рядом с картинкой). Пара к
// schema-miniapp/src/share/TherapistInviteShare.tsx — правило №3.
import { useState } from 'react';
import { ShareCardSheet } from './ShareCardSheet';
import { therapistInviteShare } from '../../../shared/src/share/cards/inviteShare';

export function TherapistInviteShare({ inviteUrl }: { inviteUrl: string }) {
  const [open, setOpen] = useState(false);
  if (!inviteUrl) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '9px 18px',
          borderRadius: 'var(--r-20)',
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--text-sub)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Поделиться
      </button>
      {open && (
        <ShareCardSheet
          {...therapistInviteShare(inviteUrl)}
          onClose={() => setOpen(false)}
          zIndex={400}
        />
      )}
    </>
  );
}
