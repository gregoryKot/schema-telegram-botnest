import { useState, useCallback, useEffect, useRef } from 'react';
import { useTr } from '../utils/addressForm';
import type { Need, DayHistory } from '../types';
import { NeedHistorySheet } from './NeedHistorySheet';
import { getTherapistContact } from '../utils/therapistContact';
import { IndexInfoSheet } from './IndexInfoSheet';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { NoteSheet } from './NoteSheet';
import { WeeklyCardSheet } from './WeeklyCardSheet';
import { BOOKING_CTA_LABEL, trackerTapHint } from '../../../shared/src/history/therapistCta';
import { DateStrip } from './history/DateStrip';
import { HistoryEmpty } from './history/HistoryEmpty';
import { HistoryDayView } from './history/HistoryDayView';
import { HistoryWeekView } from './history/HistoryWeekView';
import '../styles/sheet-diary.css';
import { ExternalLink } from '../host/ExternalLink';
import { readLocal, writeLocal } from '../../../shared/src/utils/safeLocalStorage';
import { useDayNote } from '../hooks/useDayNote';
import { isRated } from '../../../shared/src/needs/ratingRecord';
import { todayStr } from '../../../shared/src/utils/format';

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

const HISTORY_HINT_KEY = 'history_hint_dismissed';
const DAYS_OPTIONS = [7, 14, 30];

export function HistoryView({ needs, history, currentRatings, childhoodRatings = {}, onOpenSchemas, onOpenChildhoodWheel, days = 7, onChangeDays, onGoToToday, onBackfill }: Props) {
  const tr = useTr();
  const contact = getTherapistContact();
  // Терапевту не предлагаем запись к самому себе, без канала связи — некуда (null); один элемент на оба блока.
  const bookingLink = contact.isTherapist || !contact.bookingUrl ? null : <ExternalLink href={contact.bookingUrl} className="ds-link">{BOOKING_CTA_LABEL}</ExternalLink>;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [subView, setSubView] = useState<'day' | 'week'>('day');
  const dateBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeNeed, setActiveNeed] = useState<Need | null>(null);
  const [showIndexInfo, setShowIndexInfo] = useState(false);
  const [showNote, setShowNote] = useState(false);
  // Заметка выбранного дня: смена дня сбрасывает прежнюю, поздний ответ другого дня не показывается (E8).
  const dayNote = useDayNote(history[selectedIdx]?.date);
  const [showWeekCard, setShowWeekCard] = useState(false);
  const [showHint, setShowHint] = useState(() => !readLocal(HISTORY_HINT_KEY));

  // Clamp the selected index when history shrinks: setState during render is the documented
  // pattern for deriving state from props; the guard settles it in one extra render.
  if (history.length > 0 && selectedIdx >= history.length) {
    setSelectedIdx(history.length - 1);
  }

  useEffect(() => {
    scrollIntoViewSafe(dateBtnRefs.current[selectedIdx], { block: 'nearest', inline: 'center' });
  }, [selectedIdx]);

  const handleTapNeed = useCallback((n: Need) => {
    if (showHint) { writeLocal(HISTORY_HINT_KEY, '1'); setShowHint(false); }
    setActiveNeed(n);
  }, [showHint]);

  if (history.length === 0) return <HistoryEmpty onGoToToday={onGoToToday} />;

  const selected = history[selectedIdx] ?? history[0];
  const isToday = selected.date === todayStr(); // местный день, на каждом рендере: сервер кладёт дни по поясу (E5)
  const selectedRatings = isToday ? currentRatings : selected.ratings;
  const prevRatings = history[selectedIdx + 1]?.ratings ?? {};
  const ratedCount = Object.keys(selectedRatings).filter(k => isRated(selectedRatings, k)).length;
  const needsLow = history.length >= 3
    ? needs.filter(n => history.slice(0, 3).every(d => isRated(d.ratings, n.id) && d.ratings[n.id] <= 4)) : [];

  return (
    <div className="sd-history">
      <DateStrip history={history} selectedIdx={selectedIdx} onSelect={setSelectedIdx} btnRefs={dateBtnRefs} />

      <div className="sd-toolbar">
        <div className="ds-seg ds-seg--full" role="group" aria-label="Вид">
          {(['day', 'week'] as const).map(v => (
            <button key={v} onClick={() => setSubView(v)} className={'ds-seg-btn' + (subView === v ? ' is-active' : '')}>
              {v === 'day' ? 'День' : 'Неделя'}
            </button>
          ))}
        </div>
        {onChangeDays && (
          <div className="ds-seg ds-seg--full" role="group" aria-label="Период">
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
            childhoodRatings={childhoodRatings} isToday={isToday} ratedCount={ratedCount}
            historyLen={history.length} needsLow={needsLow} isTherapist={contact.isTherapist} bookingLink={bookingLink}
            noteText={dayNote.note?.text ?? null} noteTags={dayNote.note?.tags ?? []} onTapNeed={handleTapNeed} onIndexInfo={() => setShowIndexInfo(true)}
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
        <NoteSheet date={history[selectedIdx].date} onClose={() => { dayNote.reload(); setShowNote(false); }} />
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
