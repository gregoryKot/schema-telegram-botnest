import { useState, useCallback, useEffect, useRef } from 'react';
import { useTr } from '../utils/addressForm';
import type { Need, DayHistory } from '../types';
import { NeedHistorySheet } from './NeedHistorySheet';
import { getTherapistContact } from '../utils/therapistContact';
import { IndexInfoSheet } from './IndexInfoSheet';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { NoteSheet } from './NoteSheet';
import { WeeklyCardSheet } from './WeeklyCardSheet';
import { api } from '../api';
import { BOOKING_CTA_LABEL, trackerTapHint } from '../../../shared/src/history/therapistCta';
import { DateStrip } from './history/DateStrip';
import { HistoryEmpty } from './history/HistoryEmpty';
import { HistoryDayView } from './history/HistoryDayView';
import { HistoryWeekView } from './history/HistoryWeekView';
import '../styles/sheet-diary.css';
import { ExternalLink } from '../host/ExternalLink';

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

const TODAY_STR = new Date().toISOString().split('T')[0];
const HISTORY_HINT_KEY = 'history_hint_dismissed';
const DAYS_OPTIONS = [7, 14, 30];

export function HistoryView({ needs, history, currentRatings, childhoodRatings = {}, onOpenSchemas, onOpenChildhoodWheel, days = 7, onChangeDays, onGoToToday, onBackfill }: Props) {
  const tr = useTr();
  const contact = getTherapistContact();
  // Терапевту не предлагаем запись к самому себе (null); один элемент на оба блока.
  const bookingLink = contact.isTherapist ? null : <ExternalLink href={contact.bookingUrl} className="ds-link">{BOOKING_CTA_LABEL}</ExternalLink>;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [subView, setSubView] = useState<'day' | 'week'>('day');
  const dateBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeNeed, setActiveNeed] = useState<Need | null>(null);
  const [showIndexInfo, setShowIndexInfo] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState<string | null>(null);
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [showWeekCard, setShowWeekCard] = useState(false);
  const [showHint, setShowHint] = useState(() => !localStorage.getItem(HISTORY_HINT_KEY));

  // Clamp the selected index when history shrinks. Adjusting state during render
  // (not in an effect) is the documented pattern for deriving state from props;
  // the guard turns false after the set, so it settles in one extra render.
  if (history.length > 0 && selectedIdx >= history.length) {
    setSelectedIdx(history.length - 1);
  }

  useEffect(() => {
    scrollIntoViewSafe(dateBtnRefs.current[selectedIdx], { block: 'nearest', inline: 'center' });
  }, [selectedIdx]);

  useEffect(() => {
    if (history.length === 0) return;
    const date = history[selectedIdx]?.date;
    if (date) api.getNote(date).then(r => { setNoteText(r.text); setNoteTags(r.tags ?? []); });
  }, [selectedIdx, history]);

  const handleTapNeed = useCallback((n: Need) => {
    if (showHint) { localStorage.setItem(HISTORY_HINT_KEY, '1'); setShowHint(false); }
    setActiveNeed(n);
  }, [showHint]);

  if (history.length === 0) return <HistoryEmpty onGoToToday={onGoToToday} />;

  const selected = history[selectedIdx] ?? history[0];
  const selectedRatings = selected.date === TODAY_STR ? currentRatings : selected.ratings;
  const prevRatings = history[selectedIdx + 1]?.ratings ?? {};
  const ratedCount = Object.keys(selectedRatings).filter(k => (selectedRatings[k] ?? 0) > 0).length;
  const needsLow = history.length >= 3
    ? needs.filter(n => history.slice(0, 3).every(d => (d.ratings[n.id] ?? 10) <= 4)) : [];

  return (
    <div className="sd-history">
      <DateStrip history={history} needs={needs} selectedIdx={selectedIdx} onSelect={setSelectedIdx} btnRefs={dateBtnRefs} />

      <div className="sd-toolbar">
        <div className="ds-seg" role="group" aria-label="Вид">
          {(['day', 'week'] as const).map(v => (
            <button key={v} onClick={() => setSubView(v)} className={'ds-seg-btn' + (subView === v ? ' is-active' : '')}>
              {v === 'day' ? 'День' : 'Неделя'}
            </button>
          ))}
        </div>
        {onChangeDays && (
          <div className="ds-seg" role="group" aria-label="Период">
            {DAYS_OPTIONS.map(d => (
              <button key={d} onClick={() => onChangeDays(d)} className={'ds-seg-btn' + (days === d ? ' is-active' : '')}>{d}д</button>
            ))}
          </div>
        )}
        {showHint && <span className="sd-toolbar-hint">{trackerTapHint(tr)}</span>}
      </div>

      <div key={subView} className="sd-fade">
        {subView === 'day' ? (
          <HistoryDayView date={selected.date} needs={needs} ratings={selectedRatings} prevRatings={prevRatings}
            childhoodRatings={childhoodRatings} isToday={selected.date === TODAY_STR} ratedCount={ratedCount}
            historyLen={history.length} needsLow={needsLow} isTherapist={contact.isTherapist} bookingLink={bookingLink}
            noteText={noteText} noteTags={noteTags} onTapNeed={handleTapNeed} onIndexInfo={() => setShowIndexInfo(true)}
            onOpenNote={() => setShowNote(true)} onOpenSchemas={onOpenSchemas}
            onOpenChildhoodWheel={onOpenChildhoodWheel} onBackfill={onBackfill} />
        ) : (
          <HistoryWeekView needs={needs} history={history} days={days} selectedIdx={selectedIdx}
            selectedRatings={selectedRatings} needsLow={needsLow} isTherapist={contact.isTherapist}
            bookingLink={bookingLink} onTapNeed={handleTapNeed} onWeekCard={() => setShowWeekCard(true)} />
        )}
      </div>

      {/* ── Sheets ── */}
      {showNote && history[selectedIdx] && (
        <NoteSheet date={history[selectedIdx].date} onClose={() => {
          api.getNote(history[selectedIdx].date).then(r => { setNoteText(r.text); setNoteTags(r.tags ?? []); });
          setShowNote(false);
        }} />
      )}
      {showIndexInfo && <IndexInfoSheet onClose={() => setShowIndexInfo(false)} />}
      {showWeekCard && (
        <WeeklyCardSheet needs={needs} history={history.slice(0, 7)} onClose={() => setShowWeekCard(false)} />
      )}
      {activeNeed && (
        <NeedHistorySheet need={activeNeed} value={selectedRatings[activeNeed.id] ?? 0}
          history={history} childhoodValue={childhoodRatings[activeNeed.id]}
          onClose={() => setActiveNeed(null)} />
      )}
    </div>
  );
}
