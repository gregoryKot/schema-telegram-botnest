// Сущность задания по тому, куда оно ведёт (taskRoute → taskRouteEntity): знак строки TaskSign и плитка типа
// в «Поставить цель» (taskOptions.ts) берут одну карту.
import type { UserTask } from '../../api';
import { taskRoute } from '../../../../shared/src/tasks/taskRoute';
import { taskRouteEntity, type EntityId } from '../../../../shared/src/theme/entityLook';

/** Сущность задания по тому, куда оно ведёт: упражнение — его сущность, своё — «задание». */
export const taskEntity = (task: Pick<UserTask, 'type' | 'text'>): EntityId => taskRouteEntity(taskRoute(task));
