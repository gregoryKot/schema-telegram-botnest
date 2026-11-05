import { Pebbles, Strokes, Layers } from '../../components/art/PaperArt';
import { Check, Cluster, Wheel } from '../../components/art/PaperArtSigns';
import type { UserTask } from '../../api';
import { taskRoute } from '../../../../shared/src/tasks/taskRoute';

/** Знак задания по тому, куда оно ведёт: трекер, дневник, колесо, схема/тест, режим; остальное — «сделано». */
export function TaskSign({ task }: { task: Pick<UserTask, 'type' | 'text'> }) {
  switch (taskRoute(task).kind) {
    case 'tracker': return <Strokes size="row" />;
    case 'diary': return <Pebbles size="row" />;
    case 'childhood_wheel': return <Wheel size="row" />;
    case 'schema': case 'ysq': return <Layers size="row" />;
    case 'mode': return <Cluster size="row" />;
    default: return <Check size="row" />;
  }
}
