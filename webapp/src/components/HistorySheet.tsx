import { lazy, Suspense, useState } from 'react';
import type { PracticePlan, StreakData } from '../api';
import { api } from '../api';
import type { Need, DayHistory } from '../types';
import { HistorySheetSkeleton } from './HistorySheetSkeleton';
import { CheckInSheet } from './CheckInSheet';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { fillHistoryGaps } from './appShell/navigation';
import '../styles/sheet-diary.css';

const HistoryView   = lazy(() => import('./HistoryView').then(m => ({ default: m.HistoryView })));
const TrackerOverlay = lazy(() => import('./TrackerOverlay').then(m => ({ default: m.TrackerOverlay })));

interface Props {
  needs: Need[];
  history: DayHistory[];
  historyLoading: boolean;
  ratings: Record<string, number>;
  childhoodRatings: Record<string, number>;
  pendingPlans: PracticePlan[];
  streak?: StreakData;
  todayDate: string;
  historyDays: number;
  onClose: () => void;
  onOpenTracker: () => void;
  onOpenSchemas: () => void;
  onOpenChildhoodWheel: () => void;
  onDismissPlan: (id: number) => void;
  onHistoryRefreshed: (h: DayHistory[]) => void;
}

export function HistorySheet({
  needs, history, historyLoading, ratings, childhoodRatings,
  pendingPlans, todayDate, historyDays,
  onClose, onOpenTracker, onOpenSchemas, onOpenChildhoodWheel,
  onDismissPlan, onHistoryRefreshed,
}: Props) {
  const goBack = useHistorySheet(onClose);
  const [backfillDate, setBackfillDate] = useState<string | null>(null);
  const dialogA11y = useDialogA11y();

  return (
    <div {...dialogA11y} className="u-sheet-grid">
      {/* Шапка листа — ds-sheet-head/ds-back, «Оценить →» в правом слоте (#906) */}
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={goBack}>
          <GlyphArrowLeft /> Назад к трекеру
        </button>
        <button type="button" onClick={() => goBack(onOpenTracker)} className="ds-btn ds-btn--sm">
          Оценить →
        </button>
      </div>

      <div className="page">
        <div className="sd-head">
          <div className="ds-eyebrow">Трекер</div>
          <h1 className="ds-h1">История<br /><span className="it">потребностей</span></h1>
        </div>

        {historyLoading
          ? <HistorySheetSkeleton />
          : <Suspense fallback={<HistorySheetSkeleton />}>
              <HistoryView
                needs={needs}
                history={history}
                currentRatings={ratings}
                childhoodRatings={childhoodRatings}
                onOpenSchemas={onOpenSchemas}
                onOpenChildhoodWheel={onOpenChildhoodWheel}
                onGoToToday={() => goBack(onOpenTracker)}
                onBackfill={(date) => setBackfillDate(date)}
              />
            </Suspense>
        }
      </div>

      {pendingPlans.length > 0 && needs.length > 0 && (() => {
        const plan = pendingPlans.find(p => p.scheduledDate < todayDate);
        if (!plan) return null;
        const need = needs.find(n => n.id === plan.needId);
        if (!need) return null;
        return (
          <CheckInSheet
            plan={plan}
            needLabel={need.chartLabel}
            onDone={() => onDismissPlan(plan.id)}
          />
        );
      })()}

      {backfillDate && (
        <Suspense fallback={null}>
          <TrackerOverlay
            needs={needs} ratings={{}}
            onChange={() => {}} onSaved={() => {}}
            date={backfillDate}
            onClose={() => setBackfillDate(null)}
            onDone={() => {
              setBackfillDate(null);
              api.history(historyDays)
                .then(h => onHistoryRefreshed(fillHistoryGaps(h, todayDate)))
                .catch(() => {});
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
