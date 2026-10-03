// Разметка празднования серии на сайте — editorial-диалог (общий Dialog).
// Мини-апп рисует то же событие своей мобильной карточкой (shared/src/
// components/Celebration); поведение — конфетти, веха, шаринг, события — одно,
// в shared/src/hooks/useCelebration. Платформенное (tr, ссылка бота, трекинг)
// приходит пропсами из тонкой обёртки Celebration.tsx.
import { getMilestoneText, pluralDays } from '../../../shared/src/utils/celebrationText';
import { useCelebration } from '../../../shared/src/hooks/useCelebration';
import { CopyFailedHint } from '../../../shared/src/components/CopyFailedHint';
import { Dialog } from './Dialog';

interface Props {
  streak: number;
  onDone: () => void;
  insight?: string | null;
  tr: (ty: string, vy: string) => string;
  botShortUrl: string;
  trackEvent: (name: string, meta?: Record<string, unknown>) => void;
}

export function CelebrationDialog({
  streak,
  onDone,
  insight,
  tr,
  botShortUrl,
  trackEvent,
}: Props) {
  const { canvasRef, copied, failed, share, isMilestone } = useCelebration(
    streak,
    onDone,
    botShortUrl,
    trackEvent,
  );

  return (
    <Dialog
      label={`${streak} ${pluralDays(streak)} подряд`}
      onClose={onDone}
      closeOnEscape
      zIndex={500}
      maxWidth={380}
      center
      underlay={
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />
      }
    >
      <div
        data-milestone={isMilestone ? 'yes' : 'no'}
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 72,
          fontWeight: 400,
          letterSpacing: '-0.02em',
          color: isMilestone ? 'var(--accent)' : 'var(--text)',
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {streak}
      </div>
      <h2 className="dialog-title">{pluralDays(streak)} подряд</h2>
      <p className="dialog-text" style={{ marginBottom: insight ? 12 : 24 }}>
        {getMilestoneText(streak)}
      </p>
      {insight && (
        <p
          className="dialog-text"
          style={{
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
            fontSize: 13,
          }}
        >
          {insight}
        </p>
      )}
      <button className="btn-primary" onClick={share}>
        {copied ? 'Скопировано!' : 'Поделиться'}
      </button>
      <CopyFailedHint show={failed} tr={tr} marginTop={10} />
      <button className="dialog-link" onClick={onDone}>
        Закрыть
      </button>
    </Dialog>
  );
}
