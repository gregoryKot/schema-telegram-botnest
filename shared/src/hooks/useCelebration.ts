// Логика оверлея «празднование серии»: конфетти, отметка вехи, шаринг
// картинкой с откатом на копирование текста, события аналитики. Разметка —
// webapp/src/components/CelebrationDialog. Закрывает окно только человек
// (кнопка, фон, Escape) — конфетти по своему концу его не трогает.
import type { MouseEvent } from 'react';
import { useConfetti } from './useConfetti';
import { drawStreakCard, MILESTONES } from '../share/cards/streakCard';
import { shareCanvasImage } from '../share/shareImage';
import { isShareAbort } from '../share/shareOutcome';
import { streakShareText } from '../share/shareTexts';
import { SHARE_CARD_EVENT, SHARE_RESULT_EVENT } from '../share/analytics';
import { useCopyToClipboard } from '../utils/useCopyToClipboard';

export function useCelebration(
  streak: number,
  botShortUrl: string,
  trackEvent: (name: string, meta?: Record<string, unknown>) => void,
) {
  const canvasRef = useConfetti();
  const { copied, failed, copy } = useCopyToClipboard();

  async function share(e: MouseEvent) {
    e.stopPropagation();
    const text = streakShareText(streak, botShortUrl);
    try {
      const card = document.createElement('canvas'); // карточка; текст уходит с ней
      drawStreakCard(card, streak);
      await shareCanvasImage(card, text, 'streak.png');
      trackEvent(SHARE_CARD_EVENT, { kind: 'streak' });
      trackEvent(SHARE_RESULT_EVENT, { kind: 'streak', ok: true });
    } catch (err) {
      if (isShareAbort(err)) return; // закрыли шторку — не сбой, буфер не трогаем
      trackEvent(SHARE_RESULT_EVENT, { kind: 'streak', ok: false });
      await copy(text);
    }
  }

  return {
    canvasRef,
    copied,
    failed,
    share,
    isMilestone: MILESTONES.includes(streak),
  };
}
