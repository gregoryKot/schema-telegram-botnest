// Логика оверлея «празднование серии» — общая для обеих вёрсток (мини-апп:
// shared/src/components/Celebration, сайт: webapp/src/components/Celebration).
// Разметки у площадок разные (мобильная карточка против editorial-диалога),
// а поведение — конфетти, отметка вехи, шаринг картинкой с откатом на копирование
// текста, события аналитики — одно: правка не должна доезжать до одной из двух.
import type { MouseEvent } from 'react';
import { useConfetti } from './useConfetti';
import { drawStreakCard } from '../share/cards/streakCard';
import { shareCanvasImage } from '../share/shareImage';
import { streakShareText } from '../share/shareTexts';
import { SHARE_CARD_EVENT, SHARE_RESULT_EVENT } from '../share/analytics';
import { useCopyToClipboard } from '../utils/useCopyToClipboard';

const MILESTONES = [3, 7, 14, 21, 30, 60, 100];

export function useCelebration(
  streak: number,
  onDone: () => void,
  botShortUrl: string,
  trackEvent: (name: string, meta?: Record<string, unknown>) => void,
) {
  const canvasRef = useConfetti(onDone);
  const { copied, failed, copy } = useCopyToClipboard();

  async function share(e: MouseEvent) {
    e.stopPropagation();
    const text = streakShareText(streak, botShortUrl);
    try {
      // Картинка-карточка стрика; текст уходит вместе с ней
      const card = document.createElement('canvas');
      drawStreakCard(card, streak);
      await shareCanvasImage(card, text, 'streak.png');
      trackEvent(SHARE_CARD_EVENT, { kind: 'streak' });
      trackEvent(SHARE_RESULT_EVENT, { kind: 'streak', ok: true });
    } catch {
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
