// TrackerOverlay.tsx – Variant C · PickerRail (editorial triptych)

import { useState, useRef, useCallback, useEffect } from 'react';
import { COLORS, YESTERDAY } from '../types';
import type { Need } from '../types';
import { useNeedData } from '../needData';
import { NeedTodaySheet } from './NeedTodaySheet';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { api } from '../api';
import type { StreakData } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';

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
  date?: string;
  onDone?: () => void;
}

function useIsDesktop() {
  const [d, setD] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const h = () => setD(window.innerWidth >= 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return d;
}

function PickerRail({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(11, 1fr)',
          gap: 4,
        }}
      >
        {Array.from({ length: 11 }, (_, i) => {
          const active = i === value;
          const passed = value > 0 && i < value;
          return (
            <button
              key={i}
              onClick={() => onChange(i)}
              style={{
                aspectRatio: '1 / 1.2',
                border: 'none',
                borderRadius: 8,
                padding: 0,
                background: active
                  ? color
                  : passed
                    ? `color-mix(in srgb, ${color} 12%, transparent)`
                    : 'transparent',
                boxShadow: active
                  ? 'none'
                  : `inset 0 0 0 1px rgba(var(--fg-rgb),0.12)`,
                color: active
                  ? 'var(--bg)'
                  : passed
                    ? color
                    : 'var(--text-sub)',
                fontFamily: 'var(--serif)',
                fontSize: active ? 26 : 20,
                fontWeight: 400,
                fontStyle: active ? 'italic' : 'normal',
                letterSpacing: '-0.02em',
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {i}
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          fontSize: 11,
          color: 'var(--text-faint)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        <span>низко</span>
        <span>средне</span>
        <span>хорошо</span>
      </div>
      {value === 0 && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontSize: 11,
            color: 'var(--text-ghost)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          ни одна цифра не выбрана
        </div>
      )}
    </div>
  );
}

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
    const allVals = needs.map((n) => effectiveRatings[n.id] ?? 0);
    const avgIdx = allVals.reduce((a, b) => a + b, 0) / allVals.length;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: 28,
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 44,
              fontWeight: 400,
              color: 'var(--text)',
              lineHeight: 1.0,
              marginBottom: 20,
              letterSpacing: '-0.02em',
            }}
          >
            Заполнено
          </h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 4,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 72,
                color: 'var(--text)',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                fontWeight: 400,
              }}
            >
              {avgIdx.toFixed(1)}
            </span>
            <span
              style={{
                fontSize: 20,
                color: 'var(--text-sub)',
                paddingBottom: 6,
              }}
            >
              /10
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 36,
            }}
          >
            индекс дня
          </div>
          <button
            onClick={isBackfill ? (onDone ?? goBack) : goBack}
            style={{
              padding: '13px 40px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--text)',
              color: 'var(--bg)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Готово
          </button>
        </div>
      </div>
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
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {topbar}
        {/* Hero header */}
        <div
          style={{
            padding: '24px 80px 20px',
            borderBottom: '1px solid rgba(var(--fg-rgb),0.07)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 40,
            }}
          >
            <div>
              <div
                className="eyebrow"
                style={{
                  marginBottom: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  color,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--serif)',
                    fontStyle: 'italic',
                    fontSize: 14,
                    textTransform: 'none',
                    letterSpacing: 0,
                    color: 'var(--text-ghost)',
                  }}
                >
                  {String(idx + 1).padStart(2, '0')} /{' '}
                  {String(needs.length).padStart(2, '0')}
                </span>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    background: 'currentColor',
                    display: 'inline-block',
                  }}
                />
                <span>{extra?.subtitle ?? ''}</span>
              </div>
              <h1
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: 64,
                  fontWeight: 400,
                  lineHeight: 0.96,
                  letterSpacing: '-0.025em',
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                <button
                  onClick={() => setDetailNeed(need)}
                  style={{ all: 'unset', cursor: 'pointer' }}
                >
                  {needName}
                </button>
                <span style={{ marginLeft: 14, fontSize: 48 }}>
                  {need.emoji}
                </span>
              </h1>
              {extra?.desc && (
                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--text-sub)',
                    maxWidth: 520,
                  }}
                >
                  {extra.desc}
                </p>
              )}
            </div>
            {steps}
          </div>
        </div>
        {/* 3 columns */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1.25fr 1fr',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* Left – question */}
          <div
            style={{
              padding: '28px 28px 28px 80px',
              borderRight: '1px solid rgba(var(--fg-rgb),0.07)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div
              className="eyebrow"
              style={{ marginBottom: 16, color: 'var(--text-faint)' }}
            >
              вопрос дня
            </div>
            <p
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 21,
                lineHeight: 1.4,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              {extra?.question ?? ''}
            </p>
            {delta !== null && delta !== 0 && (
              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--serif)',
                    fontStyle: 'italic',
                    fontSize: 13,
                    color: 'var(--text-faint)',
                  }}
                >
                  вчера
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: delta > 0 ? 'var(--c-moss)' : 'var(--c-rose)',
                  }}
                >
                  {delta > 0 ? '+' : ''}
                  {delta}
                </span>
              </div>
            )}
          </div>
          {/* Center – picker */}
          <div
            style={{
              padding: '28px 44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '1px solid rgba(var(--fg-rgb),0.07)',
            }}
          >
            <PickerRail
              value={value}
              onChange={(v) => handleChange(need.id, v)}
              color={color}
            />
          </div>
          {/* Right – examples */}
          <div
            style={{
              padding: '28px 80px 28px 28px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div
              className="eyebrow"
              style={{ marginBottom: 16, color: 'var(--text-faint)' }}
            >
              что считается
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {(extra?.examples ?? []).map((ex, i, arr) => (
                <li
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom:
                      i < arr.length - 1
                        ? '1px solid rgba(var(--fg-rgb),0.07)'
                        : 'none',
                    alignItems: 'start',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--serif)',
                      fontStyle: 'italic',
                      fontSize: 15,
                      color: 'var(--text-ghost)',
                    }}
                  >
                    {i + 1}.
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: 'var(--text-sub)',
                    }}
                  >
                    {ex}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {footer}
        {DetailSheet}
      </div>
    );

  // ── Mobile layout ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onTouchStart={onTS}
      onTouchEnd={onTE}
    >
      {topbar}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div
            className="eyebrow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                background: 'currentColor',
                display: 'inline-block',
              }}
            />
            <span>{extra?.subtitle ?? ''}</span>
          </div>
          {steps}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            <button
              onClick={() => setDetailNeed(need)}
              style={{ all: 'unset', cursor: 'pointer' }}
            >
              <h1
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: 34,
                  fontWeight: 400,
                  lineHeight: 1.0,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                {needName}
              </h1>
            </button>
            {extra?.desc && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  lineHeight: 1.55,
                  marginTop: 6,
                }}
              >
                {extra.desc}
              </div>
            )}
          </div>
          <span style={{ fontSize: 38, lineHeight: 1, flexShrink: 0 }}>
            {need.emoji}
          </span>
        </div>
        <div
          style={{
            padding: '14px 0',
            borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
            borderBottom: '1px solid rgba(var(--fg-rgb),0.07)',
            marginBottom: 20,
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 10, color: 'var(--text-faint)' }}
          >
            вопрос дня
          </div>
          <p
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 17,
              lineHeight: 1.45,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {extra?.question ?? ''}
          </p>
        </div>
        <div style={{ marginBottom: 24 }}>
          <PickerRail
            value={value}
            onChange={(v) => handleChange(need.id, v)}
            color={color}
          />
        </div>
        <div
          style={{
            paddingTop: 4,
            borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 12, color: 'var(--text-faint)' }}
          >
            что считается
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {(extra?.examples ?? []).map((ex, i, arr) => (
              <li
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom:
                    i < arr.length - 1
                      ? '1px solid rgba(var(--fg-rgb),0.07)'
                      : 'none',
                  alignItems: 'start',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--serif)',
                    fontStyle: 'italic',
                    fontSize: 14,
                    color: 'var(--text-ghost)',
                  }}
                >
                  {i + 1}.
                </span>
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: 'var(--text-sub)',
                  }}
                >
                  {ex}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {footer}
      {DetailSheet}
    </div>
  );
}
