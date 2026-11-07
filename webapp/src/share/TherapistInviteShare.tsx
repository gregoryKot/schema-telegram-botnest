// Кнопка «Поделиться» у ссылки-приглашения клиенту: открывает карточку
// приглашения (сама ссылка уходит текстом рядом с картинкой).
import { useState } from 'react';
import { ShareCardSheet } from './ShareCardSheet';
import { therapistInviteShare } from '../../../shared/src/share/cards/inviteShare';

export function TherapistInviteShare({ inviteUrl }: { inviteUrl: string }) {
  const [open, setOpen] = useState(false);
  if (!inviteUrl) return null;
  return (
    <>
      {/* Пара к «Скопировать» (ds-btn--sm) рядом: малая кнопка 40, под пальцем 44 (блок тап-целей cabinet.css).
          Инлайн-стиль давал 114×40 и на телефоне (QA 2026-11-04, находка 16). */}
      <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setOpen(true)}>
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
