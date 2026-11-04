import type {
  TaskExercise,
  TaskRoute,
} from '../../../../shared/src/tasks/taskRoute';
import type { HelpOverlayId, HelpOverlaysState } from './useHelpOverlays';

// Маршрут задания (shared/taskRoute) → действие экрана «Помощь» мини-аппа:
// оверлей упражнения или лист, которым владеет приложение. Вынесено из
// HelpSection.tsx (правило №10); пара на сайте — webapp/useTaskLauncher.ts.

const EXERCISE_OVERLAY: Record<TaskExercise, HelpOverlayId> = {
  belief_check: 'beliefCheck',
  letter_to_self: 'letterToSelf',
  safe_place: 'safePlace',
  flashcard: 'flashcard',
};

export interface TaskRouteTargets {
  overlays: Pick<
    HelpOverlaysState,
    'show' | 'setIntroSchemaId' | 'setIntroModeId'
  >;
  onOpenDiaries: () => void;
  onOpenTracker: () => void;
  onOpenChildhoodWheel: () => void;
  /** Тест на схемы (запрос терапевта, QA 2026-11 К1): лист теста приложения. */
  onOpenYsq: () => void;
}

export function openTaskRoute(route: TaskRoute, t: TaskRouteTargets): void {
  switch (route.kind) {
    case 'diary':
      return t.onOpenDiaries();
    case 'tracker':
      return t.onOpenTracker();
    case 'childhood_wheel':
      return t.onOpenChildhoodWheel();
    case 'ysq':
      return t.onOpenYsq();
    case 'exercise':
      return t.overlays.show(EXERCISE_OVERLAY[route.exercise]);
    case 'schema':
      if (route.id) t.overlays.setIntroSchemaId(route.id);
      return;
    case 'mode':
      if (route.id) t.overlays.setIntroModeId(route.id);
      return;
  }
}
