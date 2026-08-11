// TrackerOverlay.tsx — Full tracker as standalone overlay
// Place at: src/components/TrackerOverlay.tsx (NEW FILE)
//
// This replaces the inline tracker code in App.tsx.
// Wire it up in App.tsx:
//   {showTracker && (
//     <TrackerOverlay
//       needs={needs} ratings={ratings} saved={saved}
//       onClose={() => { setShowTracker(false); setTrackerTab('today'); }}
//       initialNeedId={trackerNeedId}
//       onSaved={handleSaved} onChange={handleChange}
//       isOffline={isOffline}
//     />
//   )}

import { useState, useRef, useCallback, useEffect } from 'react';
import { pressable } from '../utils/a11y';
import { SkeletonList } from './Skeleton';
import { Need, COLORS } from '../types';
import { useNeedData } from '../needData';
import { NeedRatingBar } from './NeedRatingBar';
import { NeedTodaySheet } from './NeedTodaySheet';
import { useSafeTop } from '../utils/safezone';
import { api, StreakData } from '../api';
import { OnboardingOverlay } from './trackerOverlay/OnboardingOverlay';
import { TrackerDoneSummary } from './trackerOverlay/TrackerDoneSummary';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  saved: Record<string, boolean>;
  isOffline?: boolean;
  onChange: (needId: string, value: number) => void;
  onSaved: (needId: string, streak?: StreakData) => void;
  onClose: () => void;
  initialNeedId?: string | null;
  onOpenNote?: () => void;
  onOpenGoal?: () => void;
  onOpenHistory?: () => void;
  yesterdayRatings?: Record<string, number>;
  /** When set, enables backfill mode: saves to this past date, loads existing ratings */
  date?: string;
  onDone?: () => void;
}

const ONBOARDING_KEY = 'tracker_onboarding_v1';

export function TrackerOverlay({
  needs,
  ratings,
  saved: _saved,
  isOffline,
  onChange,
  onSaved,
  onClose,
  initialNeedId,
  onOpenNote,
  onOpenGoal: _onOpenGoal,
  onOpenHistory,
  yesterdayRatings = {},
  date,
  onDone,
}: Props) {
  const NEED_DATA = useNeedData();
  const safeTop = useSafeTop();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const unlockTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  // Backfill mode: own ratings state loaded from API for the given date
  const isBackfill = !!date;
  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});
  const [localLoading, setLocalLoading] = useState(isBackfill);

  useEffect(() => {
    if (!isBackfill) return;
    void api
      .ratings(date)
      .then((r) => setLocalRatings(r))
      .finally(() => setLocalLoading(false));
  }, [date, isBackfill]);

  const effectiveRatings = isBackfill ? localRatings : ratings;

  const [idx, setIdx] = useState(() => {
    if (initialNeedId) {
      const i = needs.findIndex((n) => n.id === initialNeedId);
      if (i >= 0) return i;
    }
    if (!isBackfill) {
      const f = needs.findIndex((n) => ratings[n.id] === undefined);
      return f >= 0 ? f : 0;
    }
    return 0;
  });
  const [_unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [detailNeed, setDetailNeed] = useState<Need | null>(null);
  const [onbStep, setOnbStep] = useState(0);
  const [showOnb, setShowOnb] = useState(
    () => !isBackfill && !localStorage.getItem(ONBOARDING_KEY),
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const need = needs[idx];
  const value = effectiveRatings[need.id] ?? 0;
  const allRated = needs.every(
    (n) => effectiveRatings[n.id] !== undefined && effectiveRatings[n.id] > 0,
  );
  const avg =
    needs.length > 0
      ? needs.reduce((s, n) => s + (effectiveRatings[n.id] ?? 0), 0) /
        needs.length
      : 0;
  const yval = yesterdayRatings[need.id];
  const delta =
    !isBackfill && value > 0 && yval !== undefined ? value - yval : null;
  const levelColor =
    value === 0
      ? 'var(--text-faint)'
      : value <= 3
        ? 'var(--accent-red)'
        : value <= 6
          ? 'var(--accent-yellow)'
          : 'var(--accent-green)';
  const levelLabel =
    value === 0
      ? '· · ·'
      : value <= 3
        ? 'низко'
        : value <= 6
          ? 'средне'
          : 'хорошо';

  const dismissOnb = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnb(false);
  }, []);

  const handleChange = useCallback(
    (needId: string, v: number) => {
      if (isBackfill) {
        setLocalRatings((prev) => ({ ...prev, [needId]: v }));
        clearTimeout(timers.current[needId]);
        timers.current[needId] = setTimeout(async () => {
          if (v === 0) return;
          try {
            await api.saveRating(needId, v, date);
            setLastSavedAt(new Date());
          } catch (e) {
            console.error('saveRating failed', e); // сеть/5xx — уже в outbox
          }
        }, 500);
        return;
      }
      onChange(needId, v);
      if (isOffline) return;
      setUnlocked((p) => new Set([...p, needId]));
      clearTimeout(unlockTimers.current[needId]);
      unlockTimers.current[needId] = setTimeout(() => {
        setUnlocked((p) => {
          const n = new Set(p);
          n.delete(needId);
          return n;
        });
      }, 2500);
      clearTimeout(timers.current[needId]);
      timers.current[needId] = setTimeout(async () => {
        if (v === 0) return;
        try {
          const res = await api.saveRating(needId, v);
          onSaved(needId, res.allDone ? res.streak : undefined);
          setLastSavedAt(new Date());
        } catch (e) {
          console.error('saveRating failed', e);
        }
      }, 500);
    },
    [onChange, onSaved, isOffline, isBackfill, date],
  );

  // Swipe between needs — high threshold to avoid accidental triggers
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  function onTS(e: React.TouchEvent) {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTE(e: React.TouchEvent) {
    if (touchRef.current === null || detailNeed) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    // Only swipe if clearly horizontal (dx much larger than dy) and long enough
    if (Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
    if (dx < 0 && idx < needs.length - 1) setIdx(idx + 1);
    if (dx > 0 && idx > 0) setIdx(idx - 1);
  }

  if (localLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            padding: '0 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <SkeletonList rows={5} h={56} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onTouchStart={onTS}
      onTouchEnd={onTE}
    >
      {/* Header */}
      <div
        style={{
          padding: `${safeTop + 16}px 20px 12px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-sub)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {isBackfill ? 'Оценки за день' : 'Трекер потребностей'}
          </div>
          <div
            style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}
          >
            {isBackfill ? date : 'свайп · тап по шкале · +/−'}
          </div>
        </div>
        {/* Карандаш + история */}
        {!isBackfill ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {onOpenNote && (
              <button
                onClick={onOpenNote}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-sub)',
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            )}
            {onOpenHistory && (
              <button
                onClick={() => {
                  onClose();
                  onOpenHistory();
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-sub)',
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div style={{ width: 34 }} />
        )}
      </div>

      {/* Onboarding */}
      {showOnb && (
        <OnboardingOverlay
          onbStep={onbStep}
          setOnbStep={setOnbStep}
          dismissOnb={dismissOnb}
        />
      )}

      {/* Need name pill — top */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: showOnb ? 4 : 8,
          textAlign: 'center',
        }}
      >
        <div
          {...pressable(() => setDetailNeed(need))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: '6px 16px',
            borderRadius: 20,
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.3px',
            }}
          >
            {need.chartLabel}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>ⓘ</span>
          {delta !== null && delta !== 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: delta > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                background:
                  delta > 0
                    ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)'
                    : 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
                borderRadius: 10,
                padding: '1px 7px',
              }}
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
        </div>
      </div>

      {/* Dial + desc — one centered column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          overflow: 'hidden',
        }}
      >
        {NEED_DATA[need.id]?.desc && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.55,
              textAlign: 'center',
              padding: '0 32px',
            }}
          >
            {NEED_DATA[need.id].desc}
          </div>
        )}

        {/* Большая цифра + уровень (раньше жили в центре круга) */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: '-5px',
              lineHeight: 1,
              color: value > 0 ? 'var(--text)' : 'var(--text-faint)',
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.3s',
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: levelColor,
              marginTop: 8,
              transition: 'color 0.3s',
            }}
          >
            {levelLabel}
          </div>
        </div>

        {/* Оценка тапом — тот же контрол, что в детали и «Вчера» */}
        <div style={{ width: '100%', maxWidth: 360, padding: '0 26px' }}>
          <NeedRatingBar
            color={COLORS[need.id] ?? '#888'}
            value={value}
            yesterday={yval}
            onChange={(v) => {
              dismissOnb();
              handleChange(need.id, v);
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => handleChange(need.id, Math.max(0, value - 1))}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              border: 'none',
              fontFamily: 'inherit',
              background: 'var(--surface-2)',
              color: 'var(--text-sub)',
              fontSize: 22,
              fontWeight: 300,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            −
          </button>
          <div
            style={{
              width: 64,
              textAlign: 'center',
              fontSize: 9,
              color: 'var(--text-faint)',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            тап по шкале
          </div>
          <button
            onClick={() => handleChange(need.id, Math.min(10, value + 1))}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              border: 'none',
              fontFamily: 'inherit',
              background: 'var(--surface-2)',
              color: 'var(--text-sub)',
              fontSize: 22,
              fontWeight: 300,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Bottom */}
      <div
        style={{
          padding: '0 20px',
          paddingBottom: 'max(20px, var(--safe-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* Summary when all done */}
        {allRated && (
          <TrackerDoneSummary
            avg={avg}
            isBackfill={isBackfill}
            onDone={onDone}
            onClose={onClose}
            needs={needs}
            ratings={ratings}
            date={date}
          />
        )}

        {/* Nav */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => idx > 0 && setIdx(idx - 1)}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: idx === 0 ? 'var(--surface)' : 'var(--surface-2)',
              color: idx === 0 ? 'var(--text-faint)' : 'var(--text-sub)',
              fontSize: 14,
              cursor: idx === 0 ? 'default' : 'pointer',
            }}
          >
            ← Назад
          </button>
          {idx < needs.length - 1 && (
            <button
              onClick={() => setIdx(idx + 1)}
              style={{
                flex: 2,
                padding: '13px',
                borderRadius: 14,
                border: 'none',
                fontFamily: 'inherit',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Далее →
            </button>
          )}
        </div>

        {/* Autosave status */}
        {lastSavedAt && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--text-faint)',
            }}
          >
            Сохранено{' '}
            {lastSavedAt.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      {detailNeed && (
        <NeedTodaySheet
          need={detailNeed}
          value={effectiveRatings[detailNeed.id] ?? 0}
          yesterdayValue={yesterdayRatings[detailNeed.id]}
          onChange={(v) => handleChange(detailNeed.id, v)}
          onClose={() => setDetailNeed(null)}
        />
      )}
    </div>
  );
}
