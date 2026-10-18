import { useState } from 'react';
import type { Need } from '../../types';
import { DayShareButton } from '../../share/DayShareButton';
import { FocusEntrySheet } from './FocusEntrySheet';
import { TodayFocusCard } from './TodayFocusCard';
import type { useTodayData } from './useTodayData';
import { useFocusPractice } from './useTodayFocusPrefs';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  /** Данные экрана: что сделано сегодня, профиль, перечитывание дневников */
  data: ReturnType<typeof useTodayData>;
  onOpenTracker: () => void;
  onOpenTrackerHistory?: () => void;
}

// Фокус-карточка + лист записи выбранного дневника. Считает прогресс трекера из
// живых оценок и собирает «Поделиться днём» (тот же DayShareButton, что в финале трекера).
export function TodayFocusBlock({ needs, ratings, data, onOpenTracker, onOpenTrackerHistory }: Props) {
  const { practice, pickPractice } = useFocusPractice();
  const { todayDone, profile, gratitudeToday, reloadDiaries } = data;
  const [entryOpen, setEntryOpen] = useState(false);
  const ratedCount = needs.filter(n => ratings[n.id] !== undefined).length;
  const allRated = needs.length > 0 && ratedCount === needs.length;
  const avgScore = allRated ? (needs.reduce((s, n) => s + ratings[n.id], 0) / needs.length).toFixed(1) : null;

  return (
    <>
      <TodayFocusCard
        practice={practice}
        ratedCount={ratedCount}
        total={needs.length}
        avgScore={avgScore}
        practiceDoneToday={practice !== 'tracker' && todayDone[practice]}
        onAction={() => (practice === 'tracker' ? onOpenTracker() : setEntryOpen(true))}
        onOpenHistory={onOpenTrackerHistory}
        onPick={pickPractice}
        shareSlot={<DayShareButton needs={needs} ratings={ratings} />}
      />
      {entryOpen && practice !== 'tracker' && (
        <FocusEntrySheet
          kind={practice}
          activeSchemaIds={profile?.ysq?.activeSchemaIds}
          gratitudeToday={gratitudeToday}
          onClose={() => setEntryOpen(false)}
          onSaved={reloadDiaries}
        />
      )}
    </>
  );
}
