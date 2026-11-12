import { Pebbles, Strokes, Layers } from '../../components/art/PaperArt';
import { Check, Cluster, Wheel } from '../../components/art/PaperArtSigns';
import { SignArt } from '../../components/art/SignArt';
import type { UserTask } from '../../api';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { taskRoute, type TaskExercise } from '../../../../shared/src/tasks/taskRoute';

/** Знак упражнения — знак его сущности (ENTITY_LOOK, строка «Цель, задание»): убеждение, письмо, безопасное место, «Мне плохо». */
const EXERCISE_SIGN: Record<TaskExercise, SignKey> = {
  belief_check: 'scales', letter_to_self: 'sheets', safe_place: 'haven', flashcard: 'heart',
};

/** Знак задания по тому, куда оно ведёт: трекер, дневник, колесо, схема/тест, режим, упражнение; остальное — «сделано». */
export function TaskSign({ task }: { task: Pick<UserTask, 'type' | 'text'> }) {
  const route = taskRoute(task);
  switch (route.kind) {
    case 'tracker': return <Strokes size="row" />;
    case 'diary': return <Pebbles size="row" />;
    case 'childhood_wheel': return <Wheel size="row" />;
    case 'schema': case 'ysq': return <Layers size="row" />;
    case 'mode': return <Cluster size="row" />;
    case 'exercise': return <SignArt sign={EXERCISE_SIGN[route.exercise]} size="row" />;
    default: return <Check size="row" />;
  }
}
