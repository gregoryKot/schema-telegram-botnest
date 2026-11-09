// TrackerOverlay: «один вопрос на экран» (простой клиент, этап 2,
// docs/design/CLIENT_SIMPLE_2026-10.md). Ответ сохраняется сразу (useRatingSaver) и
// через AUTO_ADVANCE_MS сам открывает следующую неоценённую потребность;
// когда неоценённых нет — экран «Готово». Бэкфилл прошлого дня (`date`) идёт тем же путём.

import { useState, useCallback } from 'react';
import { useNeedData } from '../needData';
import { NeedTodaySheet } from './NeedTodaySheet';
import { useRatingSaver } from '../hooks/useRatingSaver';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { trackTrackerSkip } from '../sections/today/trackHomeTile';
import { NEED_HUE } from '../lib/tone';
import type { NeedId } from '../../../shared/src/needs/types';
import { isRated, withRating } from '../../../shared/src/needs/ratingRecord';
import { formatDateString } from '../../../shared/src/utils/calendarDate';
import '../styles/sheet-tracker.css';
import '../styles/tracker-question.css';
import type { Props } from './trackerOverlay/types';
import { CompletionScreen } from './trackerOverlay/CompletionScreen';
import { QuestionScreen } from './trackerOverlay/QuestionScreen';
import { QuestionSkeleton } from './trackerOverlay/QuestionSkeleton';
import { TrackerTopbar } from './trackerOverlay/TrackerTopbar';
import { useHorizontalSwipe } from '../../../shared/src/hooks/useHorizontalSwipe';
import { nextUnrated } from './trackerOverlay/trackerFlow';
import { useAutoAdvance } from './trackerOverlay/useAutoAdvance';
import { useBackfillRatings } from './trackerOverlay/useBackfillRatings';
import { SaveErrorNote } from './SaveErrorNote';
import type { Need } from '../types';

export function TrackerOverlay({
  needs, ratings, onChange, onSaved, onClose, initialNeedId,
  onOpenNote, onOpenHistory, yesterdayRatings = {}, date, onDone,
}: Props) {
  const goBack = useHistorySheet(onClose);
  const isBackfill = !!date;
  const ids = needs.map((n) => n.id);

  const { ratings: localRatings, setRatings: setLocalRatings, loading: localLoading } = useBackfillRatings(date);
  const effectiveRatings = isBackfill ? localRatings : ratings;

  const [idx, setIdx] = useState(() => {
    if (initialNeedId) {
      const i = needs.findIndex((n) => n.id === initialNeedId);
      if (i >= 0) return i;
    }
    return isBackfill ? 0 : (nextUnrated(ids, ratings, -1, false) ?? 0);
  });
  // Всё уже оценено и открыли «просто посмотреть» — сразу «Готово», а не первый вопрос.
  const [showCompletion, setShowCompletion] = useState(
    () => !isBackfill && !initialNeedId && nextUnrated(ids, ratings, -1, false) === null,
  );
  const [detailNeed, setDetailNeed] = useState<Need | null>(null);
  // Строка «откуда это» — только на первом вопросе и пока нет ни одной оценки (решается при открытии).
  const [firstTime] = useState(() => !isBackfill && !ids.some((id) => isRated(ratings, id)));
  const [startIdx] = useState(idx);

  const NEED_DATA = useNeedData();
  const nameOf = (n: Need) => NEED_DATA[n.id]?.name ?? n.chartLabel;

  const { schedule, cancel: cancelAdvance } = useAutoAdvance();
  const goTo = (i: number) => { cancelAdvance(); setShowCompletion(false); setIdx(i); };

  const [queued, setQueued] = useState(false); // оценка ждёт в очереди — «Готово» скажет «отправятся сами»
  const [rejected, setRejected] = useState(false); // сервер отказал: плитка откатилась, вопрос открыт снова
  const save = useRatingSaver({
    onQueued: () => setQueued(true),
    onRejected: (needId, prev) => {
      if (isBackfill) setLocalRatings((r) => withRating(r, needId, prev ?? 0));
      else onChange(needId, prev ?? 0);
      setRejected(true);
      goTo(Math.max(0, ids.indexOf(needId)));
    },
    date: isBackfill ? date : undefined,
    onSaved: isBackfill ? undefined : onSaved,
    errorMessage: isBackfill ? 'tracker backfill rating save failed' : 'tracker rating save failed',
    section: 'tracker',
  });
  const handleChange = useCallback(
    (needId: string, v: number) => {
      setRejected(false);
      if (isBackfill) setLocalRatings((prev) => withRating(prev, needId, v));
      else onChange(needId, v);
      save(needId, v, effectiveRatings[needId]);
    },
    [onChange, isBackfill, save, setLocalRatings, effectiveRatings],
  );

  const goNextOrDone = (to: number | null) => (to === null ? setShowCompletion(true) : setIdx(to));

  const need = needs[idx];
  const handleAnswer = (v: number) => {
    handleChange(need.id, v);
    const to = nextUnrated(ids, { ...effectiveRatings, [need.id]: v }, idx, true);
    schedule(() => goNextOrDone(to));
  };
  const handleSkip = () => {
    cancelAdvance();
    trackTrackerSkip();
    goNextOrDone(nextUnrated(ids, effectiveRatings, idx, false));
  };

  const swipe = useHorizontalSwipe(
    () => idx < needs.length - 1 && goTo(idx + 1),
    () => idx > 0 && goTo(idx - 1),
    !!detailNeed || showCompletion,
  );

  if (localLoading) return <div className="tk2-overlay"><QuestionSkeleton onClose={goBack} /></div>;

  if (showCompletion) {
    return (
      <CompletionScreen
        needs={needs}
        effectiveRatings={effectiveRatings}
        isBackfill={isBackfill} queued={queued}
        date={date}
        onDone={onDone}
        goBack={goBack}
        onReview={goTo}
        onOpenNote={onOpenNote}
        onOpenHistory={onOpenHistory}
      />
    );
  }

  const value = effectiveRatings[need.id] ?? 0;
  return (
    <div className="tk2-overlay" {...swipe}>
      <TrackerTopbar
        needs={needs}
        idx={idx}
        ratings={effectiveRatings}
        nameOf={nameOf}
        onClose={goBack}
        onPick={goTo}
        onSkip={handleSkip}
      />
      <div className="tq-body" key={idx /* новый вопрос открывается сверху, а не на прокрутке прошлого */}>
        <QuestionScreen
          idx={idx}
          total={needs.length}
          name={nameOf(need)} needId={need.id as NeedId}
          data={NEED_DATA[need.id]}
          value={value}
          hue={NEED_HUE[need.id as NeedId]}
          yesterday={isBackfill ? undefined : yesterdayRatings[need.id]}
          caption={date ? formatDateString(date, { day: 'numeric', month: 'long' }) : undefined}
          showOriginNote={firstTime && idx === startIdx}
          alert={rejected && <SaveErrorNote ty="Эта оценка не сохранилась. Попробуй ответить ещё раз." vy="Эта оценка не сохранилась. Попробуйте ответить ещё раз." />}
          onAnswer={handleAnswer}
          onMore={() => setDetailNeed(need)}
        />
      </div>
      {detailNeed && (
        <NeedTodaySheet
          need={detailNeed}
          value={effectiveRatings[detailNeed.id] ?? 0}
          yesterdayValue={isBackfill ? undefined : yesterdayRatings[detailNeed.id]}
          onChange={(v) => handleChange(detailNeed.id, v)}
          onClose={() => setDetailNeed(null)}
        />
      )}
    </div>
  );
}
