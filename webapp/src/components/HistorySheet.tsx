import { lazy, Suspense, useState } from 'react';
import type { Need, DayHistory } from '../types';
import type { PracticePlan, StreakData } from '../api';
import { api } from '../api';
import { COLORS } from '../types';
import { Loader } from './Loader';
import { CheckInSheet } from './CheckInSheet';
import { useHistorySheet } from '../hooks/useHistorySheet';

const HistoryView   = lazy(() => import('./HistoryView').then(m => ({ default: m.HistoryView })));
const TrackerOverlay = lazy(() => import('./TrackerOverlay').then(m => ({ default: m.TrackerOverlay })));

function fillHistoryGaps(h: DayHistory[], todayDate: string): DayHistory[] {
  if (h.length === 0) return h;
  const byDate = new Map(h.map(d => [d.date, d]));
  const todayEntry = h.find(d => d.date === todayDate);
  const nonToday = h.filter(d => d.date !== todayDate);
  if (nonToday.length === 0) return h;
  const filled: DayHistory[] = todayEntry ? [todayEntry] : [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 60; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (key < nonToday[nonToday.length - 1].date) break;
    filled.push(byDate.get(key) ?? { date: key, ratings: {} });
    cursor.setDate(cursor.getDate() - 1);
  }
  return filled;
}

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
  onDismissPlan: (id: string) => void;
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
      <div className="page-inner-wide" style={{ paddingTop: 40, paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Трекер</div>
            <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 10 }}>
              История потребностей
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => { onOpenTracker(); goBack(); }} className="btn btn-primary">Оценить →</button>
            <button onClick={goBack} className="btn btn-secondary">Закрыть</button>
          </div>
        </div>
      </div>

      {historyLoading
        ? <Loader minHeight="60vh" />
        : <Suspense fallback={<Loader minHeight="60vh" />}>
            <HistoryView
              needs={needs}
              history={history}
              currentRatings={ratings}
              childhoodRatings={childhoodRatings}
              onOpenSchemas={onOpenSchemas}
              onOpenChildhoodWheel={onOpenChildhoodWheel}
              onGoToToday={() => { onOpenTracker(); goBack(); }}
              onBackfill={(date) => setBackfillDate(date)}
            />
          </Suspense>
      }
      <div style={{ height: 80 }} />

      {pendingPlans.length > 0 && needs.length > 0 && (() => {
        const plan = pendingPlans.find(p => p.scheduledDate < todayDate);
        if (!plan) return null;
        const need = needs.find(n => n.id === plan.needId);
        if (!need) return null;
        return (
          <CheckInSheet
            plan={plan}
            needEmoji={need.emoji ?? ''}
            needLabel={need.chartLabel}
            color={COLORS[need.id] ?? '#888'}
            onDone={() => onDismissPlan(plan.id)}
          />
        );
      })()}

      {backfillDate && (
        <Suspense fallback={null}>
          <TrackerOverlay
            needs={needs} ratings={{}} saved={{}}
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
