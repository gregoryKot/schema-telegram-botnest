import { Need } from '../../types';
import { Section } from '../../components/BottomNav';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings?: Record<string, number>;
  onNavigate: (s: Section) => void;
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
  onTasksChanged?: () => void;
  onNewDiaryEntry?: (t: 'schema' | 'mode' | 'gratitude') => void;
}
