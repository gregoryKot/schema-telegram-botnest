// Вынесено из App.tsx (этап 3 REMEDIATION_PLAN) — используется и в App.tsx,
// и в TrackerHistoryOverlay.tsx, без циклического импорта между ними.
// fillHistoryGaps — единственная реализация в shared (правило №3, jscpd-свип
// 2026-08: копия здесь и в webapp/appShell/navigation.ts была найдена
// храповиком дублей).
export {
  TODAY_DATE,
  TODAY_KEY,
  YESTERDAY_DATE,
  fillHistoryGaps,
} from '../../../shared/src/utils/todayConstants';
import { TODAY_KEY } from '../../../shared/src/utils/todayConstants';
export const HAS_HISTORY = Object.keys(localStorage).some(
  (k) => k.startsWith('celebrated_') && k !== TODAY_KEY,
);
