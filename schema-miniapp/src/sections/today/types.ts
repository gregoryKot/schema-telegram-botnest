import { Need } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings?: Record<string, number>;
  onOpenSchema: (opts?: {
    startTest?: boolean;
    tab?: 'needs' | 'schemas' | 'modes';
    highlight?: string;
  }) => void;
  onOpenAdvanced: () => void;
  onOpenTracker: () => void;
  onOpenTrackerAt?: (needId: string) => void;
  onOpenTrackerHistory?: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
  refreshKey?: number;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
  onNewDiaryEntry?: (t: 'schema' | 'mode' | 'gratitude') => void;
  /** Разбор случая — главное действие экрана. */
  onStartCase: () => void;
  /** Карта себя, куда складываются разборы. */
  onOpenMap: () => void;
  /** Спокойный день: отмечается наравне с разбором, а не прячется. */
  onSteadyDay: () => void;
}
