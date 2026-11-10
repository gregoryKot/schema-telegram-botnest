// Строка даты дня в ленте «Записей» (docs/design/APP_2026-11.md, b11): дата Literata, «сегодня ·
// понедельник» и трекер дня — полоски дня (Strokes values, как на главной: высота — оценка, пустое
// место — тон бумаги) с «Трекер — индекс» на соломе трекера. Раньше трекер стоял отдельной карточкой в каждом
// дне (~40% высоты ленты при одной цифре); день только с трекером теперь — одна эта строка. Тап
// открывает историю оценок; без onOpen (лист «Дневники» из практик) строка не нажимается.
import { Strokes } from '../../components/art/PaperArt';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { dateRelLabel, fmtDayMonth, fmtWeekday } from './dateHelpers';
import { trackerDayLabel, type TrackerDay } from './trackerEntries';

function TrackerChip({ day, onOpen }: { day: TrackerDay; onOpen?: () => void }) {
  const body = (
    <>
      <span className="pp-row-art" aria-hidden="true"><Strokes size="row" values={day.values} /></span>
      <span className="cd-tracker-val" aria-hidden="true">{trackerDayLabel(day)}</span>
      {onOpen && <span className="ds-chev" aria-hidden="true" />}
    </>
  );
  const paper = hueStyle(ENTITY_LOOK.tracker.hue);
  return onOpen
    ? <button type="button" className="cd-tracker" style={paper} aria-label={trackerDayLabel(day)} onClick={onOpen}>{body}</button>
    : <span className="cd-tracker" style={paper} role="img" aria-label={trackerDayLabel(day)}>{body}</span>;
}

export function DayHead({ dateKey, tracker, onOpenTracker }: { dateKey: string; tracker: TrackerDay | null; onOpenTracker?: () => void }) {
  const rel = dateRelLabel(dateKey);
  return (
    <div className="cd-day-head">
      <div className="cd-day-when">
        <div className="cd-day-date">{fmtDayMonth(dateKey)}</div>
        <div className="cd-day-rel">{rel ? `${rel} · ` : ''}{fmtWeekday(dateKey)}</div>
      </div>
      {tracker && <TrackerChip day={tracker} onOpen={onOpenTracker} />}
    </div>
  );
}
