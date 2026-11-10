// Сущность задания по тому, куда оно ведёт: знак строки TaskSign и плитка типа в «Поставить цель» (taskOptions.ts)
// берут одну карту. Таблица — литералами рядом с потребителем, сверка с `taskRouteEntity` из shared/src/theme
// (TaskRow.test.tsx): рантайм-вызов `taskRouteEntity` в модулях заданий уносил ExScreen в свой чанк — его CSS
// вставал до index.css и правила упражнений проигрывали `.ds-label` (check-css-link-order, сведение g6;
// docs/open/frontend-ux.md, «Рантайм-импорт entityLook»).
import type { UserTask } from '../../api';
import { taskRoute, type TaskExercise, type TaskRoute } from '../../../../shared/src/tasks/taskRoute';
import type { EntityId } from '../../../../shared/src/theme/entityLook';

const EXERCISE: Record<TaskExercise, EntityId> = {
  belief_check: 'belief_check',
  letter_to_self: 'letter',
  safe_place: 'safe_place',
  flashcard: 'sos',
};

const ROUTE: Record<Exclude<TaskRoute['kind'], 'exercise'>, EntityId> = {
  diary: 'diary',
  tracker: 'tracker',
  childhood_wheel: 'childhood_wheel',
  schema: 'schema_card',
  mode: 'mode_card',
  ysq: 'ysq',
  self: 'task',
  none: 'task',
};

/** Сущность маршрута задания: упражнение — его сущность, своё — «задание». */
export const routeEntity = (route: TaskRoute): EntityId =>
  route.kind === 'exercise' ? EXERCISE[route.exercise] : ROUTE[route.kind];

/** Сущность задания по тому, куда оно ведёт. */
export const taskEntity = (task: Pick<UserTask, 'type' | 'text'>): EntityId => routeEntity(taskRoute(task));
