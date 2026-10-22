// TrackerOverlay.tsx – Variant C · PickerRail (editorial triptych)

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNeedData } from '../needData';
import { NeedTodaySheet } from './NeedTodaySheet';
import { api } from '../api';
import { useRatingSaver } from '../hooks/useRatingSaver';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { deltaView } from '../sections/today/model';
import { TrackerSteps } from './trackerOverlay/TrackerChrome';
import { buildChrome } from './trackerOverlay/buildChrome';
import '../styles/sheet-tracker.css';
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
  const value = effectiveRatings[need.id] ?? 0;
  const allRated = needs.every((n) => (effectiveRatings[n.id] ?? 0) > 0);
  // Только реальные вчерашние оценки: нет данных — нет дельты (правило
  // CLAUDE.md «Никаких хардкод-заглушек»; фолбэк на константу YESTERDAY —
  // ровно инцидент из правила, miniapp-двойник всегда был чист).
  const yval = yesterdayRatings[need.id];
  const delta = isBackfill ? null : deltaView(value > 0 ? value : undefined, yval);
  const NEED_DATA = useNeedData();
  const extra = NEED_DATA[need.id];
  const needName = extra?.name ?? need.chartLabel;

  const markSaved = useCallback(() => setLastSavedAt(new Date()), []);
  // Бэкафилл пишет оценки прошлого дня: своя дата, без стрика и без офлайн-паузы.
  const save = useRatingSaver({
    date: isBackfill ? date : undefined,
    isOffline: !isBackfill && isOffline,
    onSaved: isBackfill ? undefined : onSaved,
    onSavedAt: markSaved,
    errorMessage: isBackfill ? 'tracker backfill rating save failed' : 'tracker rating save failed',
    section: 'tracker',
  });
  const handleChange = useCallback(
    (needId: string, v: number) => {
      if (isBackfill) setLocalRatings((prev) => ({ ...prev, [needId]: v }));
      else onChange(needId, v);
      save(needId, v);
    },
    [onChange, isBackfill, save],
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
      <div className="tk2-overlay tk2-done">
        <div className="ds-sub">Загрузка...</div>
      </div>
    );

  if (showCompletion) {
    return (
      <CompletionScreen
        needs={needs}
        effectiveRatings={effectiveRatings}
        isBackfill={isBackfill}
        date={date}
        onDone={onDone}
        goBack={goBack}
      />
    );
  }

  const nameOf = (n: Need) => NEED_DATA[n.id]?.name ?? n.chartLabel;
  const steps = <TrackerSteps needs={needs} idx={idx} ratings={effectiveRatings} onPick={setIdx} />;
  const { topbar, footer, onboarding } = buildChrome({
    isDesktop,
    isBackfill,
    date,
    goBack,
    onOpenNote,
    onOpenHistory,
    needs,
    idx,
    setIdx,
    allRated,
    lastSavedAt,
    effectiveRatings,
    ratings,
    nameOf,
    onFinish: () => setShowCompletion(true),
  });

  const DetailSheet = detailNeed ? (
    <NeedTodaySheet
      need={detailNeed}
      value={effectiveRatings[detailNeed.id] ?? 0}
      yesterdayValue={yesterdayRatings[detailNeed.id]}
      onChange={(v) => handleChange(detailNeed.id, v)}
      onClose={() => setDetailNeed(null)}
    />
  ) : null;

  const shared = {
    need,
    value,
    needName,
    extra,
    idx,
    needsLength: needs.length,
    handleChange,
    setDetailNeed,
    yesterday: isBackfill ? undefined : yval,
    delta,
    topbar,
    footer,
    steps,
    detailSheet: DetailSheet,
  };
  if (isDesktop) return <DesktopLayout {...shared} />;
  return <MobileLayout {...shared} onboarding={onboarding} onTS={onTS} onTE={onTE} />;
}
