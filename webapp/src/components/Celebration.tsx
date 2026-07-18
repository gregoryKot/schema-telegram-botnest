import { useState } from 'react';
import { botShortUrl } from '../utils/botConfig';
import { getMilestoneText, pluralDays } from '../../../shared/src/utils/celebrationText';
import { useConfetti } from '../../../shared/src/hooks/useConfetti';
import { drawStreakCard } from '../../../shared/src/share/cards/streakCard';
import { shareCanvasImage } from '../../../shared/src/share/shareImage';
import { streakShareText } from '../../../shared/src/share/shareTexts';
import { SHARE_CARD_EVENT } from '../../../shared/src/share/analytics';
import { api } from '../api';

interface Props {
  streak: number;
  onDone: () => void;
  /** Фраза-интерпретация сегодняшнего профиля (todayInsightPhrase) — «мгновенный aha», этап 4.2. */
  insight?: string | null;
}

export function Celebration({ streak, onDone, insight }: Props) {
  const canvasRef = useConfetti(onDone);
  const [copied, setCopied] = useState(false);

  const isMilestone = [3, 7, 14, 21, 30, 60, 100].includes(streak);

  return (
    <div role="presentation" onClick={onDone} style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        background: 'var(--bg)', borderRadius: 24,
        padding: '32px 36px', margin: '0 32px',
        border: '1px solid rgba(var(--fg-rgb),0.12)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        animation: 'sheet-up 400ms cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>
          {isMilestone ? '🏆' : '🔥'}
        </div>
        <div style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>
          {streak}
        </div>
        <div style={{ fontSize: 16, color: 'var(--text-sub)', marginBottom: 16 }}>
          {pluralDays(streak)} подряд
        </div>
        <div style={{ fontSize: 14, color: 'rgba(var(--fg-rgb),0.75)', lineHeight: 1.5, maxWidth: 220 }}>
          {getMilestoneText(streak)}
        </div>
        {insight && (
          <div style={{
            fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55,
            maxWidth: 240, marginTop: 12, paddingTop: 12,
            borderTop: '1px solid rgba(var(--fg-rgb),0.08)',
          }}>
            {insight}
          </div>
        )}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const text = streakShareText(streak, botShortUrl);
            try {
              // Картинка-карточка стрика; текст уходит вместе с ней
              const card = document.createElement('canvas');
              drawStreakCard(card, streak);
              await shareCanvasImage(card, text, 'streak.png');
              api.trackEvent(SHARE_CARD_EVENT, { kind: 'streak' });
            } catch {
              try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* best-effort: ошибку намеренно игнорируем */ }
            }
          }}
          style={{
            marginTop: 16,
            padding: '10px 24px', border: 'none', borderRadius: 20,
            background: 'rgba(var(--fg-rgb),0.15)', color: 'var(--text)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {copied ? 'Скопировано!' : 'Поделиться'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 12 }}>
          нажми в другом месте, чтобы закрыть
        </div>
      </div>
    </div>
  );
}
