import { Skeleton, SkeletonList } from '../Skeleton';
import { SpreadLayout } from '../paper/SpreadLayout';
import { hueStyle } from '../../lib/tone';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

/**
 * Загрузка бэкфилла: силуэт экрана вопроса — верхняя полоса с живым «Закрыть» (выйти можно и
 * пока грузится), лист потребности (надпись, название, описание) и пять плашек ответов в той же
 * раскладке, что сам вопрос (разворот на компьютере). Оболочку-оверлей даёт TrackerOverlay.
 */
export function QuestionSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="tq-bar">
        <button type="button" className="tq-bar-btn" onClick={onClose}>Закрыть</button>
        <div className="tq-dots" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className="tq-dot-hit"><span className="tq-dot" /></span>)}
        </div>
        <span />
      </div>
      <div className="tq-body" role="status" aria-busy="true" aria-label="Загружаются оценки дня">
        <div className="tq-ask" aria-hidden>
          <SpreadLayout side={
            <div className="pp-paper pa-sheet pa-sheet--plain tq-sheet-skel" style={hueStyle(ENTITY_LOOK.tracker.hue)}>
              <div className="pa-sheet-body">
                <Skeleton width="48%" height={12} />
                <Skeleton width="66%" height={32} radius={10} />
                <Skeleton width="92%" height={15} />
                <Skeleton width="70%" height={15} />
              </div>
            </div>
          }>
            <Skeleton width="90%" height={17} />
            <SkeletonList rows={5} height={56} radius={18} gap={10} />
          </SpreadLayout>
        </div>
      </div>
    </>
  );
}
