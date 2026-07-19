import { useState, useCallback, useEffect, useRef } from 'react';
import { useTr } from '../utils/addressForm';
import { Need, DayHistory } from '../types';
import { NeedHistorySheet } from './NeedHistorySheet';
import { getTherapistContact } from '../utils/therapistContact';
import { IndexInfoSheet } from './IndexInfoSheet';
import { NoteSheet } from './NoteSheet';
import { WeeklyCardSheet } from './WeeklyCardSheet';
import { api } from '../api';
import {
  TODAY_STR,
  HISTORY_HINT_KEY,
  DAYS_OPTIONS,
  getDayAbbr,
  getDayNum,
  dayAvg,
} from './historyView/constants';
import { NeedsWheel } from './historyView/NeedsWheel';
import { NeedRow } from './historyView/NeedRow';
import { SparklineRow } from './historyView/SparklineRow';
import { InsightCard } from './historyView/InsightCard';

interface Props {
  needs: Need[];
  history: DayHistory[];
  currentRatings: Record<string, number>;
  childhoodRatings?: Partial<Record<string, number>>;
  onOpenSchemas?: () => void;
  onOpenChildhoodWheel?: () => void;
  days?: number;
  onChangeDays?: (days: number) => void;
  onGoToToday?: () => void;
  onBackfill?: (date: string) => void;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function HistoryView({
  needs,
  history,
  currentRatings,
  childhoodRatings = {},
  onOpenSchemas,
  onOpenChildhoodWheel,
  days = 7,
  onChangeDays,
  onGoToToday,
  onBackfill,
}: Props) {
  const tr = useTr();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [subView, setSubView] = useState<'day' | 'week'>('day');
  const dateBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeNeed, setActiveNeed] = useState<Need | null>(null);
  const [showIndexInfo, setShowIndexInfo] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState<string | null>(null);
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [showWeekCard, setShowWeekCard] = useState(false);
  const [showHint, setShowHint] = useState(
    () => !localStorage.getItem(HISTORY_HINT_KEY),
  );

  useEffect(() => {
    if (history.length > 0 && selectedIdx >= history.length)
      setSelectedIdx(history.length - 1);
  }, [history.length, selectedIdx]);

  useEffect(() => {
    dateBtnRefs.current[selectedIdx]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [selectedIdx]);

  useEffect(() => {
    if (history.length === 0) return;
    const date = history[selectedIdx]?.date;
    if (date)
      void api.getNote(date).then((r) => {
        setNoteText(r.text);
        setNoteTags(r.tags ?? []);
      });
  }, [selectedIdx, history]);

  const handleTapNeed = useCallback(
    (n: Need) => {
      if (showHint) {
        localStorage.setItem(HISTORY_HINT_KEY, '1');
        setShowHint(false);
      }
      setActiveNeed(n);
    },
    [showHint],
  );

  // Empty state
  if (history.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 10,
          }}
        >
          История пока пуста
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
            marginBottom: 28,
          }}
        >
          {tr(
            'Заполни трекер сегодня — через 3–5 дней начнёт проявляться паттерн',
            'Заполните трекер сегодня — через 3–5 дней начнёт проявляться паттерн',
          )}
        </div>
        {onGoToToday && (
          <button
            onClick={onGoToToday}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            Заполнить сегодня
          </button>
        )}
      </div>
    );
  }

  const selected = history[selectedIdx] ?? history[0];
  const selectedRatings =
    selected.date === TODAY_STR ? currentRatings : selected.ratings;
  const prevRatings = history[selectedIdx + 1]?.ratings ?? {};
  const ratedCount = Object.keys(selectedRatings).filter(
    (k) => (selectedRatings[k] ?? 0) > 0,
  ).length;
  const needsLow =
    history.length >= 3
      ? needs.filter((n) =>
          history.slice(0, 3).every((d) => (d.ratings[n.id] ?? 10) <= 4),
        )
      : [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 0 80px',
      }}
    >
      {/* ── Date picker ── */}
      <div
        style={{
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '0 16px 16px',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {history.map((day, i) => {
            const active = i === selectedIdx;
            const avg = dayAvg(day, needs);
            const hasData = avg !== null;
            const barColor = !hasData
              ? 'rgba(var(--fg-rgb),0.1)'
              : avg >= 7
                ? 'var(--accent-green)'
                : avg >= 4
                  ? 'var(--accent-yellow)'
                  : 'var(--accent-red)';
            const barW = hasData ? Math.round((avg / 10) * 100) : 0;

            return (
              <button
                key={day.date}
                ref={(el) => {
                  dateBtnRefs.current[i] = el;
                }}
                onClick={() => setSelectedIdx(i)}
                style={{
                  flexShrink: 0,
                  width: 44,
                  padding: '8px 0 10px',
                  border: 'none',
                  borderRadius: 14,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'center',
                  background: active
                    ? 'var(--accent)'
                    : 'rgba(var(--fg-rgb),0.05)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: active
                      ? 'rgba(255,255,255,0.75)'
                      : 'var(--text-faint)',
                  }}
                >
                  {getDayAbbr(day.date)}
                </span>
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: active ? '#fff' : 'var(--text)',
                  }}
                >
                  {getDayNum(day.date)}
                </span>
                {/* Mini score bar */}
                <div
                  style={{
                    width: 24,
                    height: 3,
                    borderRadius: 2,
                    background: active
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(var(--fg-rgb),0.08)',
                    overflow: 'hidden',
                  }}
                >
                  {hasData && (
                    <div
                      style={{
                        width: `${barW}%`,
                        height: '100%',
                        borderRadius: 2,
                        background: active ? '#fff' : barColor,
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
        {/* Day / Week toggle */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            background: 'rgba(var(--fg-rgb),0.06)',
            borderRadius: 12,
            padding: 3,
          }}
        >
          {(['day', 'week'] as const).map((v) => {
            const active = subView === v;
            return (
              <button
                key={v}
                onClick={() => setSubView(v)}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  border: 'none',
                  borderRadius: 10,
                  fontFamily: 'inherit',
                  background: active ? 'var(--surface)' : 'transparent',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  color: active ? 'var(--text)' : 'var(--text-faint)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {v === 'day' ? 'День' : 'Неделя'}
              </button>
            );
          })}
        </div>

        {/* Depth */}
        {onChangeDays && (
          <div
            style={{
              display: 'flex',
              background: 'rgba(var(--fg-rgb),0.06)',
              borderRadius: 12,
              padding: 3,
            }}
          >
            {DAYS_OPTIONS.map((d) => {
              const active = days === d;
              return (
                <button
                  key={d}
                  onClick={() => onChangeDays(d)}
                  style={{
                    padding: '7px 10px',
                    border: 'none',
                    borderRadius: 10,
                    fontFamily: 'inherit',
                    background: active ? 'var(--surface)' : 'transparent',
                    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    color: active ? 'var(--text)' : 'var(--text-faint)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d}д
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div key={subView} style={{ animation: 'fade-in 200ms ease' }}>
        {subView === 'day' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '0 16px',
            }}
          >
            {/* Wheel card */}
            <div
              className="card"
              style={{ borderRadius: 20, paddingTop: 4, paddingBottom: 8 }}
            >
              <div key={selected.date}>
                <NeedsWheel
                  needs={needs}
                  ratings={selectedRatings}
                  prevRatings={prevRatings}
                  childhoodRatings={childhoodRatings}
                  onClickNeed={handleTapNeed}
                  onClickCenter={() => setShowIndexInfo(true)}
                />
              </div>

              {/* Links row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 20,
                  paddingBottom: 8,
                }}
              >
                {Object.keys(childhoodRatings).length > 0 ? (
                  <div
                    onClick={onOpenChildhoodWheel}
                    role={onOpenChildhoodWheel ? 'button' : undefined}
                    tabIndex={onOpenChildhoodWheel ? 0 : undefined}
                    onKeyDown={
                      onOpenChildhoodWheel
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenChildhoodWheel();
                            }
                          }
                        : undefined
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: onOpenChildhoodWheel ? 'pointer' : 'default',
                    }}
                  >
                    <svg width={16} height={6}>
                      <line
                        x1={0}
                        y1={3}
                        x2={16}
                        y2={3}
                        stroke="rgba(var(--fg-rgb),0.3)"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                      />
                    </svg>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      детство
                    </span>
                    {onOpenChildhoodWheel && (
                      <span style={{ fontSize: 12, color: 'var(--accent)' }}>
                        →
                      </span>
                    )}
                  </div>
                ) : onOpenChildhoodWheel ? (
                  <div
                    onClick={onOpenChildhoodWheel}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenChildhoodWheel();
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--accent)' }}>
                      🌱 Оценить детство →
                    </span>
                  </div>
                ) : null}
                {onOpenSchemas && (
                  <div
                    onClick={onOpenSchemas}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenSchemas();
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--accent)' }}>
                      Что за этим стоит →
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Hint */}
            {showHint && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-faint)',
                }}
              >
                {tr(
                  'Нажми на потребность — узнаешь что делать',
                  'Нажмите на потребность — узнаете что делать',
                )}
              </div>
            )}

            {/* Backfill — any past day (partial or empty) */}
            {onBackfill && selected.date !== TODAY_STR && (
              <div
                onClick={() => onBackfill(selected.date)}
                className="card"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onBackfill(selected.date);
                  }
                }}
                style={{
                  borderRadius: 16,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  background:
                    ratedCount === 0
                      ? 'color-mix(in srgb, var(--accent-blue) 7%, var(--surface))'
                      : 'var(--surface)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    flexShrink: 0,
                    background:
                      'color-mix(in srgb, var(--accent-blue) 14%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  📅
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--accent-blue)',
                    }}
                  >
                    {ratedCount === 0
                      ? 'Заполнить этот день'
                      : `Дополнить оценки`}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-sub)',
                      marginTop: 2,
                    }}
                  >
                    {ratedCount === 0
                      ? 'Оценки за этот день не заполнены'
                      : `Заполнено ${ratedCount} из ${needs.length}`}
                  </div>
                </div>
                <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>
                  ›
                </span>
              </div>
            )}

            {/* Need rows */}
            {needs.map((n) => (
              <NeedRow
                key={n.id}
                need={n}
                value={selectedRatings[n.id] ?? 0}
                onTap={() => handleTapNeed(n)}
              />
            ))}

            {/* Insight */}
            <InsightCard
              needs={needs}
              ratings={selectedRatings}
              onTap={handleTapNeed}
            />

            {/* Therapist CTA */}
            {needsLow.length > 0 && (
              <div
                className="card"
                style={{ borderRadius: 16, padding: '16px' }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    lineHeight: 1.65,
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ color: 'var(--text)' }}>
                    {needsLow[0].chartLabel}
                  </strong>{' '}
                  остаётся низкой несколько дней подряд. Иногда за этим стоит
                  что-то важное — терапевт поможет разобраться.
                </div>
                <a
                  href={getTherapistContact().bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 13,
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Записаться и взять сводку →
                </a>
              </div>
            )}

            {/* Note */}
            <div
              onClick={() => setShowNote(true)}
              className="card"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowNote(true);
                }
              }}
              style={{
                borderRadius: 14,
                padding: '12px 14px',
                cursor: 'pointer',
                border: noteText
                  ? undefined
                  : '1px dashed rgba(var(--fg-rgb),0.14)',
                boxShadow: noteText ? undefined : 'none',
                background: noteText ? undefined : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>📝</span>
              <span
                style={{
                  fontSize: 13,
                  color: noteText ? 'var(--text-sub)' : 'var(--text-faint)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {noteText || 'Добавить заметку к этому дню'}
              </span>
              {noteText && (
                <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>
                  ›
                </span>
              )}
            </div>
            {noteTags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: -4,
                }}
              >
                {noteTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontWeight: 500,
                      background:
                        'color-mix(in srgb, var(--accent) 12%, transparent)',
                      color: 'var(--accent)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Early nudge */}
            {history.length < 3 && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--text-faint)',
                  padding: '4px 0 8px',
                }}
              >
                Ещё {3 - history.length}{' '}
                {3 - history.length === 1 ? 'день' : 'дня'} — и паттерн начнёт
                проявляться
              </div>
            )}
          </div>
        ) : (
          /* ── Неделя ── */
          <div
            style={{
              padding: '0 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div className="section-label" style={{ marginBottom: 4 }}>
              За {days} дней
            </div>

            {needs.map((need) => (
              <SparklineRow
                key={need.id}
                need={need}
                history={history}
                selectedIdx={selectedIdx}
                selectedRatings={selectedRatings}
                onClick={() => handleTapNeed(need)}
              />
            ))}

            <InsightCard
              needs={needs}
              ratings={selectedRatings}
              onTap={handleTapNeed}
            />

            {needsLow.length > 0 && (
              <div
                className="card"
                style={{ borderRadius: 16, padding: '16px' }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    lineHeight: 1.65,
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ color: 'var(--text)' }}>
                    {needsLow[0].chartLabel}
                  </strong>{' '}
                  остаётся низкой несколько дней — разобраться с живым человеком
                  рядом бывает легче.
                </div>
                <a
                  href={getTherapistContact().bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 13,
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Записаться →
                </a>
              </div>
            )}

            <button
              onClick={() => setShowWeekCard(true)}
              className="card"
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 16,
                fontFamily: 'inherit',
                color: 'var(--text-sub)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>🪄</span> Карточка недели
            </button>
          </div>
        )}
      </div>

      {/* ── Sheets ── */}
      {showNote && history[selectedIdx] && (
        <NoteSheet
          date={history[selectedIdx].date}
          onClose={() => {
            void api.getNote(history[selectedIdx].date).then((r) => {
              setNoteText(r.text);
              setNoteTags(r.tags ?? []);
            });
            setShowNote(false);
          }}
        />
      )}
      {showIndexInfo && (
        <IndexInfoSheet onClose={() => setShowIndexInfo(false)} />
      )}
      {showWeekCard && (
        <WeeklyCardSheet
          needs={needs}
          history={history.slice(0, 7)}
          onClose={() => setShowWeekCard(false)}
        />
      )}
      {activeNeed && (
        <NeedHistorySheet
          need={activeNeed}
          value={selectedRatings[activeNeed.id] ?? 0}
          history={history}
          childhoodValue={childhoodRatings[activeNeed.id]}
          onClose={() => setActiveNeed(null)}
        />
      )}
    </div>
  );
}
