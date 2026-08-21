import { useState, useCallback, useEffect, useRef } from 'react';
import { useTr } from '../utils/addressForm';
import { Need, DayHistory } from '../types';
import { NeedHistorySheet } from './NeedHistorySheet';
import { getTherapistContact } from '../utils/therapistContact';
import { IndexInfoSheet } from './IndexInfoSheet';
import { NoteSheet } from './NoteSheet';
import { WeeklyCardSheet } from './WeeklyCardSheet';
import { api } from '../api';
import { TODAY_STR, HISTORY_HINT_KEY } from './historyView/constants';
import { WheelCard } from './historyView/WheelCard';
import { NeedRow } from './historyView/NeedRow';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { InsightCard } from './historyView/InsightCard';
import { HistoryDatePicker } from './historyView/HistoryDatePicker';
import { HistoryControls } from './historyView/HistoryControls';
import { HistoryWeekView } from './historyView/HistoryWeekView';
import {
  BOOKING_CTA_LABEL,
  trackerTapHint,
} from '../../../shared/src/history/therapistCta';

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
  const contact = getTherapistContact();
  // Терапевту не предлагаем запись к самому себе (null); один хелпер на оба блока.
  const bookingLink = (label: string) =>
    contact.isTherapist ? null : (
      <a
        href={contact.bookingUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          fontSize: 13,
          color: 'var(--accent)',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        {label}
      </a>
    );
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
    scrollIntoViewSafe(dateBtnRefs.current[selectedIdx], {
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
      <HistoryDatePicker
        history={history}
        needs={needs}
        selectedIdx={selectedIdx}
        onSelect={setSelectedIdx}
        dateBtnRefs={dateBtnRefs}
      />

      {/* ── Controls ── */}
      <HistoryControls
        subView={subView}
        onSubView={setSubView}
        days={days}
        onChangeDays={onChangeDays}
      />

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
            <WheelCard
              needs={needs}
              ratings={selectedRatings}
              prevRatings={prevRatings}
              childhoodRatings={childhoodRatings}
              onClickNeed={handleTapNeed}
              onClickCenter={() => setShowIndexInfo(true)}
              selectedDate={selected.date}
              onOpenChildhoodWheel={onOpenChildhoodWheel}
              onOpenSchemas={onOpenSchemas}
            />

            {/* Hint */}
            {showHint && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-faint)',
                }}
              >
                {trackerTapHint(tr)}
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
                  остаётся низкой несколько дней подряд.
                  {!contact.isTherapist &&
                    ' Иногда за этим стоит что-то важное — терапевт поможет разобраться.'}
                </div>
                {bookingLink(BOOKING_CTA_LABEL)}
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
          <HistoryWeekView
            needs={needs}
            history={history}
            selectedIdx={selectedIdx}
            selectedRatings={selectedRatings}
            days={days}
            needsLow={needsLow}
            isTherapist={contact.isTherapist}
            bookingLink={bookingLink}
            onTapNeed={handleTapNeed}
            onShowWeekCard={() => setShowWeekCard(true)}
          />
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
