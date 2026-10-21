import { useState } from 'react';
import type { Need } from '../../types';
import { DayShareButton } from '../../share/DayShareButton';
import { FocusEntrySheet } from './FocusEntrySheet';
import { TodayFocusCard } from './TodayFocusCard';
import type { useTodayData } from './useTodayData';
import type { LongPressProps } from '../../../../shared/src/hooks/useLongPress';
import type { FocusPractice } from '../../../../shared/src/today/todayFocus';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  /** Данные экрана: что сделано сегодня, профиль, перечитывание дневников */
  data: ReturnType<typeof useTodayData>;
  onOpenTracker: () => void;
  onOpenTrackerHistory?: () => void;
  /** Главная практика дня и её смена — настройка «Сегодня», общая с мини-аппом. */
  practice: FocusPractice;
  onPickPractice: (p: FocusPractice) => void;
  /** Долгое нажатие на карточку открывает «Настроить экран» с её строкой. */
  hold?: LongPressProps;
}

// Фокус-карточка + лист записи выбранного дневника. Считает прогресс трекера из
// живых оценок и собирает «Поделиться днём» (тот же DayShareButton, что в финале трекера).
export function TodayFocusBlock({ needs, ratings, data, onOpenTracker, onOpenTrackerHistory, practice, onPickPractice, hold }: Props) {
  const { todayDone, profile, gratitudeToday, reloadDiaries } = data;
  const [entryOpen, setEntryOpen] = useState(false);
  const ratedCount = needs.filter(n => ratings[n.id] !== undefined).length;
  const allRated = needs.length > 0 && ratedCount === needs.length;
  const avgScore = allRated ? (needs.reduce((s, n) => s + ratings[n.id], 0) / needs.length).toFixed(1) : null;

  return (
    <>
      <TodayFocusCard
        practice={practice}
        hold={hold}
        ratedCount={ratedCount}
        total={needs.length}
        avgScore={avgScore}
        practiceDoneToday={practice !== 'tracker' && todayDone[practice]}
        onAction={() => (practice === 'tracker' ? onOpenTracker() : setEntryOpen(true))}
        onOpenHistory={onOpenTrackerHistory}
        onPick={onPickPractice}
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
