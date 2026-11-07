import type { Need } from '../../types';
import type { StreakData } from '../../api';

export interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  isOffline?: boolean;
  onChange: (needId: string, value: number) => void;
  onSaved: (needId: string, streak?: StreakData) => void;
  onClose: () => void;
  initialNeedId?: string | null;
  /** «Заметка» на экране «Готово». */
  onOpenNote?: () => void;
  /** Открыть историю (экран «Готово», «История →»). */
  onOpenHistory?: () => void;
  yesterdayRatings?: Record<string, number>;
  /** День бэкфилла (YYYY-MM-DD) из HistorySheet; нет — трекер за сегодня. */
  date?: string;
  onDone?: () => void;
}
