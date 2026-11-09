// Разметка празднования серии на сайте — диалог (общий Dialog) с листом бумаги сверху.
// Поведение — конфетти, веха, шаринг, события — в shared/src/hooks/useCelebration;
// платформенное (tr, ссылка бота, трекинг) приходит пропсами из тонкой обёртки
// Celebration.tsx. onDone зовут только действия человека.
// Вид (редизайн 2026-11, b07): сверху сцена SceneCheckIn на соломе — лист сегодняшнего дня
// поверх листов прошлых дней серии (из ежедневных отметок складывается картина), число серии —
// Literata на бумажной наклейке цветом текста, а не красной цифрой; веха — персик и Leaf (рост).
import type { CSSProperties } from 'react';
import { getMilestoneText, pluralDays } from '../../../shared/src/utils/celebrationText';
import { useCelebration } from '../../../shared/src/hooks/useCelebration';
import { CopyFailedHint } from '../../../shared/src/components/CopyFailedHint';
import { ENTITY_LOOK } from '../../../shared/src/theme/entityLook';
import { SceneCheckIn } from './art/LandingScenesMore';
import { SignArt } from './art/SignArt';
import { Dialog } from './Dialog';

interface Props {
  streak: number;
  onDone: () => void;
  insight?: string | null;
  tr: (ty: string, vy: string) => string;
  botShortUrl: string;
  trackEvent: (name: string, meta?: Record<string, unknown>) => void;
}

export function CelebrationDialog({ streak, onDone, insight, tr, botShortUrl, trackEvent }: Props) {
  const { canvasRef, copied, failed, share, isMilestone } = useCelebration(streak, botShortUrl, trackEvent);
  const hue = isMilestone ? ENTITY_LOOK.diary.hue : ENTITY_LOOK.tracker.hue;

  return (
    <Dialog
      label={`${streak} ${pluralDays(streak)} подряд`}
      onClose={onDone}
      closeOnEscape
      zIndex={500}
      maxWidth={420}
      center
      underlay={<canvas ref={canvasRef} className="sk-celebr-canvas" />}
    >
      <div className="sk-celebr-top" style={{ '--h': hue } as CSSProperties}>
        <div className="pp-paper sk-celebr-band" aria-hidden="true">
          <SceneCheckIn hue={hue} days={streak} />
          {isMilestone && <span className="sk-celebr-leaf"><SignArt sign="leaf" size="square" /></span>}
        </div>
        <div data-milestone={isMilestone ? 'yes' : 'no'} className="ds-num sk-celebr-num">{streak}</div>
      </div>
      <h2 className="ds-h2 sk-dialog-title">{pluralDays(streak)} подряд</h2>
      <p className={'sk-dialog-text' + (insight ? ' sk-celebr-tight' : '')}>{getMilestoneText(streak)}</p>
      {insight && <p className="sk-dialog-text sk-celebr-insight">{insight}</p>}
      <button className="ds-btn sk-wide sk-celebr-share" onClick={share}>
        {copied && <span className="sk-celebr-check" aria-hidden="true"><SignArt sign="check" size="nav" /></span>}
        {copied ? 'Скопировано!' : 'Поделиться'}
      </button>
      <CopyFailedHint show={failed} tr={tr} marginTop={10} />
      <button className="ds-link sk-dialog-link" onClick={onDone}>Закрыть</button>
    </Dialog>
  );
}
