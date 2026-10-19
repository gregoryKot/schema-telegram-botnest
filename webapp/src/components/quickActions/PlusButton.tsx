// Кнопка «+» быстрых действий — только на мобильной вёрстке (по CSS, тот же
// порог 768px, что у .mobile-nav). Зона нажатия 56×56. Прячется, пока открыт
// любой лист/оверлей (реестр useHistorySheet) и пока человек печатает
// (экранная клавиатура): иначе налезает на «Дальше» и на сами листы.
import { api } from '../../api';
import { useAnySheetOpen } from '../../hooks/openSheets';
import { useTextEntryFocus } from '../../hooks/useTextEntryFocus';
import '../../styles/quick-actions.css';

export function PlusButton({ onOpen }: { onOpen: () => void }) {
  const sheetOpen = useAnySheetOpen();
  const typing = useTextEntryFocus();
  if (sheetOpen || typing) return null;
  return (
    <button
      type="button"
      className="qa-plus"
      aria-label="Быстрое действие"
      onClick={() => {
        api.trackEvent('plus_open');
        onOpen();
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="10" y="2" width="2" height="18" rx="1" fill="currentColor" />
        <rect x="2" y="10" width="18" height="2" rx="1" fill="currentColor" />
      </svg>
    </button>
  );
}
