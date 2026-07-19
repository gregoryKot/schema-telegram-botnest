// Кнопка «Поделиться днём» + шит с карточкой дня. Единственная реализация
// механики «поделиться заполненным днём» в мини-аппе (правило «одна механика —
// один компонент»): финиш трекера (TrackerOverlay) и экран «Сегодня»
// (TodayFocusCard через shareSlot). Логика — shared/useDayShare.
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
  /** zIndex шита — поверх вызывающего оверлея */
  zIndex?: number;
}

export function DayShareButton({ needs, ratings, date, zIndex }: Props) {
  const [open, setOpen] = useState(false);
  const share = useDayShare(needs, ratings, date, botShortUrl);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 44,
          borderRadius: 14,
          border:
            '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
          background: 'color-mix(in srgb, var(--accent) 9%, transparent)',
          color: 'var(--accent)',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <ShareIcon />
        Поделиться днём
      </button>

      {open && (
        <ShareCardSheet
          {...share}
          onClose={() => setOpen(false)}
          zIndex={zIndex}
          therapyNote
        />
      )}
    </>
  );
}
