import type { ReactNode } from 'react';
import type { Need } from '../../types';
import type { NeedExtra } from '../../needData';
import type { StreakData } from '../../api';

export interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  saved: Record<string, boolean>;
  isOffline?: boolean;
  onChange: (needId: string, value: number) => void;
  onSaved: (needId: string, streak?: StreakData) => void;
  onClose: () => void;
  initialNeedId?: string | null;
  onOpenNote?: () => void;
  onOpenGoal?: () => void;
  onOpenHistory?: () => void;
  yesterdayRatings?: Record<string, number>;
  date?: string;
  onDone?: () => void;
}

/** Общие пропсы обеих раскладок (desktop / mobile). */
export interface LayoutProps {
  need: Need;
  color: string;
  value: number;
  needName: string;
  extra: NeedExtra | undefined;
  idx: number;
  needsLength: number;
  handleChange: (needId: string, v: number) => void;
  setDetailNeed: (n: Need) => void;
  topbar: ReactNode;
  footer: ReactNode;
  steps: ReactNode;
  detailSheet: ReactNode;
}
