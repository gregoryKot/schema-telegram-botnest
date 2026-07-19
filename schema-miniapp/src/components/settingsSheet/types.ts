import type { useReducedMotionPref } from '../../hooks/useReducedMotionPref';

export type View = 'main' | 'time' | 'tz' | 'freq' | 'quiet';

export type MotionPref = ReturnType<typeof useReducedMotionPref>;

export interface Props {
  onClose: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  displayName?: string | null;
  onNameChanged?: (name: string) => void;
  onOpenTherapistCabinet?: () => void;
  therapistMode?: boolean;
  onToggleTherapistMode?: () => void;
  onResignTherapist?: () => Promise<void> | void;
}
