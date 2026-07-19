// TrackerOverlay.tsx – Variant C · PickerRail (editorial triptych)

import { useState, useRef, useCallback, useEffect } from 'react';
import { COLORS, YESTERDAY } from '../types';
import { useNeedData } from '../needData';
import { NeedTodaySheet } from './NeedTodaySheet';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { api } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import type { Props } from './trackerOverlay/types';
import { useIsDesktop } from './trackerOverlay/useIsDesktop';
import { CompletionScreen } from './trackerOverlay/CompletionScreen';
import { DesktopLayout } from './trackerOverlay/DesktopLayout';
import { MobileLayout } from './trackerOverlay/MobileLayout';
import type { Need } from '../types';

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
  const goBack = useHistorySheet(onClose);
  const isDesktop = useIsDesktop();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isBackfill = !!date;

  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});
  const [localLoading, setLocalLoading] = useState(isBackfill);
  useEffect(() => {
    if (!isBackfill) return;
    api
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
  const [detailNeed, setDetailNeed] = useState<Need | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

  const need = needs[idx];
  const color = COLORS[need.id] ?? 'var(--accent)';
  const value = effectiveRatings[need.id] ?? 0;
  const allRated = needs.every((n) => (effectiveRatings[n.id] ?? 0) > 0);
  const yval = yesterdayRatings[need.id] ?? YESTERDAY[need.id];
  const delta =
    !isBackfill && value > 0 && yval !== undefined ? value - yval : null;
  const NEED_DATA = useNeedData();
  const extra = NEED_DATA[need.id];
  const needName = extra?.name ?? need.chartLabel;

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
          } catch {
            /* best-effort: ошибку намеренно игнорируем */
          }
        }, 500);
        return;
      }
      onChange(needId, v);
      if (isOffline) return;
      clearTimeout(timers.current[needId]);
      timers.current[needId] = setTimeout(async () => {
        if (v === 0) return;
        try {
          const res = await api.saveRating(needId, v);
          onSaved(needId, res.allDone ? res.streak : undefined);
          setLastSavedAt(new Date());
        } catch {
          /* best-effort: ошибку намеренно игнорируем */
        }
      }, 500);
    },
    [onChange, onSaved, isOffline, isBackfill, date],
  );

  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const onTS = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTE = (e: React.TouchEvent) => {
    if (!touchRef.current || detailNeed) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
    if (dx < 0 && idx < needs.length - 1) setIdx(idx + 1);
    if (dx > 0 && idx > 0) setIdx(idx - 1);
  };

  if (localLoading)
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
        <div style={{ fontSize: 14, color: 'var(--text-sub)' }}>
          Загрузка...
        </div>
      </div>
    );

  if (showCompletion) {
    return (
      <CompletionScreen
        needs={needs}
        effectiveRatings={effectiveRatings}
        isBackfill={isBackfill}
        onDone={onDone}
        goBack={goBack}
      />
    );
  }

  const prevNeed = needs[idx - 1];
  const nextNeed = needs[idx + 1];

  const steps = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {needs.map((n, i) => (
        <button
          key={n.id}
          onClick={() => setIdx(i)}
          aria-label={n.chartLabel}
          style={{
            width: i === idx ? 22 : 6,
            height: 6,
            borderRadius: 3,
            border: 'none',
            padding: 0,
            background:
              i === idx
                ? (COLORS[n.id] ?? 'var(--accent)')
                : (effectiveRatings[n.id] ?? 0) > 0
                  ? 'rgba(var(--fg-rgb),0.3)'
                  : 'rgba(var(--fg-rgb),0.12)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        />
      ))}
    </div>
  );

  const topbar = (
    <div
      style={{
        height: 52,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(var(--fg-rgb),0.07)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={goBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          color: 'var(--text-sub)',
          fontSize: 13,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <GlyphArrowLeft /> {isBackfill ? 'Закрыть' : 'Назад'}
      </button>
      {isDesktop && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {isBackfill ? `Оценки за ${date}` : 'Трекер потребностей'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 2 }}>
        {onOpenNote && (
          <button
            onClick={onOpenNote}
            aria-label="Заметка"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              display: 'grid',
              placeItems: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--text-faint)',
              cursor: 'pointer',
            }}
          >
            <svg
              width="14"
              height="14"
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
              onOpenHistory();
              goBack();
            }}
            aria-label="История"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              display: 'grid',
              placeItems: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--text-faint)',
              cursor: 'pointer',
            }}
          >
            <svg
              width="14"
              height="14"
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
    </div>
  );

  const footer = (
    <div
      style={{
        padding: '14px 24px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
        flexShrink: 0,
        gap: 8,
      }}
    >
      {/* Left: previous need */}
      <div>
        <button
          onClick={() => idx > 0 && setIdx(idx - 1)}
          disabled={idx === 0}
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 8,
            background: 'none',
            border: 'none',
            cursor: idx === 0 ? 'default' : 'pointer',
            padding: 0,
            color: idx === 0 ? 'transparent' : 'var(--text-faint)',
            fontSize: 14,
          }}
        >
          <span>←</span>
          {prevNeed && (
            <span
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 15,
              }}
            >
              {(
                NEED_DATA[prevNeed.id]?.name ?? prevNeed.chartLabel
              ).toLowerCase()}
            </span>
          )}
        </button>
      </div>
      {/* Center: auto-save label — stays perfectly centered regardless of button widths */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-ghost)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {lastSavedAt
          ? `сохранено ${lastSavedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          : 'сохранено автоматически'}
      </div>
      {/* Right: action button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {allRated ? (
          <button
            onClick={() => setShowCompletion(true)}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--text)',
              color: 'var(--bg)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ✓ Готово
          </button>
        ) : nextNeed ? (
          <button
            onClick={() => setIdx(idx + 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--text)',
              color: 'var(--bg)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontWeight: 400,
              }}
            >
              далее:{' '}
              {(
                NEED_DATA[nextNeed.id]?.name ?? nextNeed.chartLabel
              ).toLowerCase()}
            </span>
            <span>→</span>
          </button>
        ) : (
          <button
            onClick={() => {
              const f = needs.findIndex((n) => !(effectiveRatings[n.id] ?? 0));
              if (f >= 0) setIdx(f);
            }}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid rgba(var(--fg-rgb),0.12)',
              background: 'transparent',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            К незаполненным ↩
          </button>
        )}
      </div>
    </div>
  );

  const DetailSheet = detailNeed ? (
    <NeedTodaySheet
      need={detailNeed}
      value={effectiveRatings[detailNeed.id] ?? 0}
      yesterdayValue={
        yesterdayRatings[detailNeed.id] ?? YESTERDAY[detailNeed.id]
      }
      onChange={(v) => handleChange(detailNeed.id, v)}
      onClose={() => setDetailNeed(null)}
    />
  ) : null;

  // ── Desktop triptych ───────────────────────────────────────────────────────
  if (isDesktop)
    return (
      <DesktopLayout
        need={need}
        color={color}
        value={value}
        needName={needName}
        extra={extra}
        idx={idx}
        needsLength={needs.length}
        handleChange={handleChange}
        setDetailNeed={setDetailNeed}
        delta={delta}
        topbar={topbar}
        footer={footer}
        steps={steps}
        detailSheet={DetailSheet}
      />
    );

  // ── Mobile layout ──────────────────────────────────────────────────────────
  return (
    <MobileLayout
      need={need}
      color={color}
      value={value}
      needName={needName}
      extra={extra}
      idx={idx}
      needsLength={needs.length}
      handleChange={handleChange}
      setDetailNeed={setDetailNeed}
      onTS={onTS}
      onTE={onTE}
      topbar={topbar}
      footer={footer}
      steps={steps}
      detailSheet={DetailSheet}
    />
  );
}
