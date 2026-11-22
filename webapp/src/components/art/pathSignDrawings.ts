// Рисунки знаков «Пути терапии» (ключи — PATH_SIGN_KEYS); часть таблицы guideSignDrawings.ts.
import type { ReactElement } from 'react';
import type { PathSign } from '../../../../shared/src/theme/pathSignKeys';
import type { ArtProps } from './paper';
import { PathAssessment, PathAutonomy, PathAwareness, PathHealing, PathManaging, PathOverview, PathSafety } from './PathSigns';
import { PathChecklist, PathModeOrder, PathProgress, PathProtocols, PathSession, PathStuck, PathTemplate, PathTimeline } from './PathSignsTopics';

export const PATH_SIGN_ART: Record<PathSign, (p: ArtProps) => ReactElement> = {
  path_overview: PathOverview, path_assessment: PathAssessment, path_safety: PathSafety, path_awareness: PathAwareness,
  path_managing: PathManaging, path_healing: PathHealing, path_autonomy: PathAutonomy,
  path_mode_order: PathModeOrder, path_timeline: PathTimeline, path_session: PathSession, path_progress: PathProgress,
  path_stuck: PathStuck, path_checklist: PathChecklist, path_protocols: PathProtocols, path_template: PathTemplate,
};
