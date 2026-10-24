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
          className="sk-celebr-canvas"
        />
      }
    >
      <div
        data-milestone={isMilestone ? 'yes' : 'no'}
        className="ds-num sk-celebr-num"
      >
        {streak}
      </div>
      <h2 className="ds-h2 sk-dialog-title">{pluralDays(streak)} подряд</h2>
      <p className={'sk-dialog-text' + (insight ? ' sk-celebr-tight' : '')}>
        {getMilestoneText(streak)}
      </p>
      {insight && (
        <p className="sk-dialog-text sk-celebr-insight">
          {insight}
        </p>
      )}
      <button className="ds-btn sk-wide" onClick={share}>
        {copied ? 'Скопировано!' : 'Поделиться'}
      </button>
      <CopyFailedHint show={failed} tr={tr} marginTop={10} />
      <button className="ds-link sk-dialog-link" onClick={onDone}>
        Закрыть
      </button>
    </Dialog>
  );
}
