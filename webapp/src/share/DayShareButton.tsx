// Кнопка «Поделиться днём» + шит с карточкой дня (webapp). Парный файл:
// schema-miniapp/src/share/DayShareButton.tsx — логика в shared/useDayShare,
// вёрстка per-frontend (правило №3).
import { useState } from 'react';
import type { Need } from '../types';
import { ShareCardSheet } from './ShareCardSheet';
import { useDayShare } from '../../../shared/src/share/useDayShare';
import { ShareIcon } from '../../../shared/src/share/ShareIcon';
import { botShortUrl } from '../utils/botConfig';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  /** Дата карточки (YYYY-MM-DD); по умолчанию сегодня */
  date?: string;
}

export function DayShareButton({ needs, ratings, date }: Props) {
  const [open, setOpen] = useState(false);
  const share = useDayShare(needs, ratings, date, botShortUrl);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '13px 28px',
          borderRadius: 10,
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--text)',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <ShareIcon />
        Поделиться днём
      </button>

      {open && <ShareCardSheet {...share} onClose={() => setOpen(false)} />}
    </>
  );
}
