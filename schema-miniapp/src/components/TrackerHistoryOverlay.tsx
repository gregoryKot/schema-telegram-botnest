import { Need, DayHistory, COLORS } from '../types';
import { api, PracticePlan } from '../api';
import { Loader } from './Loader';
import { HistoryView } from './HistoryView';
import { CheckInSheet } from './CheckInSheet';
import { TrackerOverlay } from './TrackerOverlay';
import { UseSheetsReturn } from '../hooks/useSheets';
import {
  TODAY_DATE,
  YESTERDAY_DATE,
  fillHistoryGaps,
} from '../utils/todayConstants';

function formatHeaderDate(): string {
  const now = new Date();
  const dow = now.toLocaleDateString('ru-RU', { weekday: 'short' });
  const date = now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
  return `${dow}, ${date}`;
}

interface Props {
  sheets: UseSheetsReturn;
  safeTop: number;
  needs: Need[];
  history: DayHistory[];
  historyLoading: boolean;
  setHistory: (h: DayHistory[]) => void;
  setHistoryLoading: (v: boolean) => void;
  ratings: Record<string, number>;
  childhoodRatings: Record<string, number>;
  pendingPlans: PracticePlan[];
  setPendingPlans: (updater: (prev: PracticePlan[]) => PracticePlan[]) => void;
  historyDays: number;
  showYesterdaySheet: boolean;
  setShowYesterdaySheet: (v: boolean) => void;
  backfillDate: string | null;
  setBackfillDate: (v: string | null) => void;
}

// Полноэкранная «История потребностей», открывается из sheets.tracker.
// Перенесено из App.tsx как есть (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function TrackerHistoryOverlay({
  sheets,
  safeTop,
  needs,
  history,
  historyLoading,
  setHistory,
  setHistoryLoading,
  ratings,
  childhoodRatings,
  pendingPlans,
  setPendingPlans,
  historyDays,
  showYesterdaySheet,
  setShowYesterdaySheet,
  backfillDate,
  setBackfillDate,
}: Props) {
  if (!sheets.tracker) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--bg)',
        overflowY: 'auto',
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: `${safeTop + 16}px 20px 14px`,
          borderBottom: '1px solid rgba(var(--fg-rgb),0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <button
            onClick={() => sheets.close('tracker', { trackerTab: 'today' })}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-sub)',
              fontSize: 14,
              cursor: 'pointer',
              padding: '0 4px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ‹ Назад
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {formatHeaderDate()}
          </span>
          <button
            onClick={() => {
              sheets.close('tracker', { trackerTab: 'today' });
              sheets.open('trackerOverlay', { trackerNeedId: null });
            }}
            style={{
              background:
                'color-mix(in srgb, var(--accent) 10%, var(--surface-2))',
              border:
                '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
              borderRadius: 10,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--accent)',
              fontFamily: 'inherit',
            }}
          >
            Оценить →
          </button>
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.4px',
            color: 'var(--text)',
            lineHeight: 1.1,
          }}
        >
          История потребностей
        </h1>
      </div>

      {historyLoading ? (
        <Loader minHeight="60vh" />
      ) : (
        <HistoryView
          needs={needs}
          history={history}
          currentRatings={ratings}
          childhoodRatings={childhoodRatings}
          onOpenSchemas={() => sheets.open('schemaInfo')}
          onOpenChildhoodWheel={() => sheets.open('childhoodWheel')}
          onGoToToday={() => {
            sheets.close('tracker');
            sheets.open('trackerOverlay', { trackerNeedId: null });
          }}
          onBackfill={(date) => setBackfillDate(date)}
        />
      )}
      <div style={{ height: 80 }} />

      {pendingPlans.length > 0 &&
        needs.length > 0 &&
        (() => {
          const plan = pendingPlans.find((p) => p.scheduledDate < TODAY_DATE);
          if (!plan) return null;
          const need = needs.find((n) => n.id === plan.needId);
          if (!need) return null;
          return (
            <CheckInSheet
              plan={plan}
              needEmoji={need.emoji ?? ''}
              needLabel={need.chartLabel}
              color={COLORS[need.id] ?? '#888'}
              onDone={() =>
                setPendingPlans((prev) => prev.filter((p) => p.id !== plan.id))
              }
            />
          );
        })()}

      {showYesterdaySheet && (
        <TrackerOverlay
          needs={needs}
          ratings={{}}
          saved={{}}
          onChange={() => {}}
          onSaved={() => {}}
          date={YESTERDAY_DATE}
          onClose={() => {
            setShowYesterdaySheet(false);
          }}
          onDone={() => {
            setShowYesterdaySheet(false);
            setHistoryLoading(true);
            void api
              .history(historyDays)
              .then((h) => setHistory(fillHistoryGaps(h)))
              .finally(() => setHistoryLoading(false));
          }}
        />
      )}
      {backfillDate && (
        <TrackerOverlay
          needs={needs}
          ratings={{}}
          saved={{}}
          onChange={() => {}}
          onSaved={() => {}}
          date={backfillDate}
          onClose={() => {
            setBackfillDate(null);
          }}
          onDone={() => {
            setBackfillDate(null);
            setHistoryLoading(true);
            void api
              .history(historyDays)
              .then((h) => setHistory(fillHistoryGaps(h)))
              .finally(() => setHistoryLoading(false));
          }}
        />
      )}
    </div>
  );
}
