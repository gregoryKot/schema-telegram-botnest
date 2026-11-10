// Дыхание 4-4-6 листом — из ⌘K, «Минута дыхания» на итоге разбора и «Что поможет» паттерна.
// Тот же живой лист, что в разделе «Практики» (BreathingCard), а не пошаговые «Вдохни на 4 счёта /
// Дальше»: до 2026-11 у одной практики было две механики (правило №3). Оболочка — BottomSheetShell
// + useHistorySheet («Назад» браузера закрывает лист); карточка шаринга — снаружи оболочки, слоем
// выше (300 → 320), как у пошаговых практик.
import type { ReactNode } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { BottomSheetShell } from '../BottomSheetShell';
import { BreathingCard } from './BreathingCard';

export function BreathingSheet({ onClose, note }: { onClose: () => void; note?: ReactNode }) {
  const goBack = useHistorySheet(onClose);
  return (
    <BreathingCard
      onClose={goBack}
      note={note}
      shareZIndex={320}
      frame={(view) => (
        <BottomSheetShell goBack={goBack} zIndex={300} maxWidth={560} label="Дыхание 4-4-6">
          {view}
        </BottomSheetShell>
      )}
    />
  );
}
