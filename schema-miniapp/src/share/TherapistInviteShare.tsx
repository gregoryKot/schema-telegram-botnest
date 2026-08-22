// Кнопка «Поделиться» у ссылки-приглашения клиенту: открывает карточку
// приглашения (сама ссылка уходит текстом рядом с картинкой). Пара к
// webapp/src/share/TherapistInviteShare.tsx — правило №3.
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
          flex: 1,
          padding: '10px 0',
          borderRadius: 'var(--r-10)',
          border: 'none',
          background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
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
