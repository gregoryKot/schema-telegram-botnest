// Кнопка «Поделиться днём» + шит с карточкой дня (webapp). Логика в shared/useDayShare
// (правило №3).
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
  /** Вид кнопки задаёт экран своим классом (строка «Готово» трекера, `.tq-go-row--share`). */
  className: string;
}

export function DayShareButton({ needs, ratings, date, className }: Props) {
  const [open, setOpen] = useState(false);
  const share = useDayShare(needs, ratings, date, botShortUrl);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <ShareIcon />
        Поделиться днём
      </button>

      {open && <ShareCardSheet {...share} onClose={() => setOpen(false)} therapyNote />}
    </>
  );
}
