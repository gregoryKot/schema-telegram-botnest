// Празднование серии (конфетти-оверлей после отметки дня) — единственная
// копия (правило №3). До 2026-08 жил в двух версиях: webapp уже прошёл
// «отказ от эмодзи» (веха — акцентный цвет числа), мини-апп отстал с 🏆/🔥.
// Канон — безэмодзийная версия. Платформенное приходит пропсами:
// tr (ты/вы), botShortUrl и trackEvent — у каждого фронтенда свои.
import { useState } from 'react';
import { getMilestoneText, pluralDays } from '../utils/celebrationText';
import { useConfetti } from '../hooks/useConfetti';
import { drawStreakCard } from '../share/cards/streakCard';
import { shareCanvasImage } from '../share/shareImage';
import { streakShareText } from '../share/shareTexts';
import { SHARE_CARD_EVENT, SHARE_RESULT_EVENT } from '../share/analytics';

export interface CelebrationProps {
  streak: number;
  onDone: () => void;
  /** Фраза-интерпретация сегодняшнего профиля (todayInsightPhrase) — «мгновенный aha». */
  insight?: string | null;
  tr: (ty: string, vy: string) => string;
  botShortUrl: string;
  trackEvent: (name: string, meta?: Record<string, unknown>) => void;
}

export function Celebration({
  streak,
  onDone,
  insight,
  tr,
  botShortUrl,
  trackEvent,
}: CelebrationProps) {
  const canvasRef = useConfetti(onDone);
  const [copied, setCopied] = useState(false);

  // Веху раньше отмечал 🏆 против 🔥. Картинок больше нет, но отличать вехи
  // надо: 7/30/100 дней — другое событие, чем «ещё один день». Отмечаем
  // акцентом на числе, а словами это уже делает getMilestoneText.
  const isMilestone = [3, 7, 14, 21, 30, 60, 100].includes(streak);

  return (
    <div
      role="presentation"
      onClick={onDone}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          background: 'var(--bg)',
          borderRadius: 24,
          padding: '32px 36px',
          margin: '0 32px',
          border: '1px solid rgba(var(--fg-rgb),0.12)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          animation: 'sheet-up 400ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          data-milestone={isMilestone ? 'yes' : 'no'}
          style={{
            fontSize: 52,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: isMilestone ? 'var(--accent)' : 'var(--text)',
            lineHeight: 1,
            marginTop: 12,
            marginBottom: 6,
          }}
        >
          {streak}
        </div>
        <div
          style={{ fontSize: 16, color: 'var(--text-sub)', marginBottom: 16 }}
        >
          {pluralDays(streak)} подряд
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'rgba(var(--fg-rgb),0.75)',
            lineHeight: 1.5,
            maxWidth: 220,
          }}
        >
          {getMilestoneText(streak)}
        </div>
        {insight && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.55,
              maxWidth: 240,
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid rgba(var(--fg-rgb),0.08)',
            }}
          >
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
              trackEvent(SHARE_CARD_EVENT, { kind: 'streak' });
              trackEvent(SHARE_RESULT_EVENT, { kind: 'streak', ok: true });
            } catch {
              trackEvent(SHARE_RESULT_EVENT, { kind: 'streak', ok: false });
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* best-effort: ошибку намеренно игнорируем */
              }
            }
          }}
          style={{
            marginTop: 16,
            padding: '10px 24px',
            border: 'none',
            borderRadius: 20,
            background: 'rgba(var(--fg-rgb),0.15)',
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {copied ? 'Скопировано!' : 'Поделиться'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 12 }}>
          {tr(
            'нажми в другом месте, чтобы закрыть',
            'нажмите в другом месте, чтобы закрыть',
          )}
        </div>
      </div>
    </div>
  );
}
