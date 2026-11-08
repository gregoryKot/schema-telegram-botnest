// Кнопка «Поделиться» у ссылки-приглашения клиенту: открывает карточку
// приглашения (сама ссылка уходит текстом рядом с картинкой).
import { useState } from 'react';
import { ShareCardSheet } from './ShareCardSheet';
import { therapistInviteShare } from '../../../shared/src/share/cards/inviteShare';
import type { TherapistInviteLinks } from '../../../shared/src/share/shareTexts';

/** В сообщении — сайт, код и Telegram второй строкой (аудит 2026-11, U3). */
export function TherapistInviteShare({ invite }: { invite: TherapistInviteLinks }) {
  const [open, setOpen] = useState(false);
  if (!invite.url) return null;
  return (
    <>
      {/* Пара к «Скопировать» (ds-btn--sm) рядом: малая кнопка 40, под пальцем 44 (блок тап-целей cabinet.css).
          Инлайн-стиль давал 114×40 и на телефоне (QA 2026-11-04, находка 16). */}
      <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setOpen(true)}>
        Поделиться
      </button>
      {open && (
        <ShareCardSheet
          {...therapistInviteShare(invite)}
          onClose={() => setOpen(false)}
          zIndex={400}
        />
      )}
    </>
  );
}
