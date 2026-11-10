import { YsqResultTopBar } from '../../../../shared/src/components/YsqResultTopBar';
import { EntitySheet } from '../paper/EntitySheet';
import { api } from '../../api';
import type { ResultView } from '../../hooks/useYsqTest';

type Tr = (ty: string, vy: string) => string;

/** Герой результата теста: лист схем (глина, Layers крупно, ENTITY_LOOK.ysq) с итогом и датой, под ним —
 *  «Как понимать» и «Поделиться» (правило онбординга: объяснение — с самого верха). На компьютере —
 *  колонка разворота слева, результаты справа (SsSheet spread). */
export function YsqResultHero({ tr, view, onShare }: { tr: Tr; view: ResultView; onShare: () => void }) {
  return (
    <>
      <EntitySheet look="ysq" title={view.activeLabel} sub={view.dateLabel ? `Пройдено ${view.dateLabel}` : undefined}
        titleAs="h1" className="ss-hero ss-res-hero" />
      <YsqResultTopBar tr={tr} onShare={onShare} onHelpOpen={() => api.trackEvent('ysq_help_open')} />
    </>
  );
}
