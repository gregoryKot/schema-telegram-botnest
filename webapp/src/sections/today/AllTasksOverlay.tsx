import type { UserTask } from '../../api';
import { OverlayFrame } from '../../components/OverlayFrame';
import { EntitySheet } from '../../components/paper/EntitySheet';
import { SpreadLayout } from '../../components/paper/SpreadLayout';
import { SkeletonList } from '../../components/Skeleton';
import { useIsMobile } from '../../components/useIsMobile';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { todayStr } from '../../utils/format';
import { groupTasks } from '../practice/taskListModel';
import { TaskListGroups } from '../tasks/TaskListGroups';
import { TaskSaveError } from './TaskSaveError';

interface Props {
  /** «Задания» в «Ещё», «Все цели» в «Практике». */
  title: string;
  tasks: UserTask[];
  taskHistory: UserTask[];
  onClose: () => void;
  /** Тот же маршрут, что у строки экрана (useTaskLauncher.openTask). */
  onOpen: (task: UserTask) => void;
  onComplete: (task: UserTask) => void | Promise<unknown>;
  onAdd: () => void;
  /** Отказ «Готово» или перечитывания после новой цели (useTaskActions.taskError). */
  error?: boolean;
  /** Список ещё грузится (узел «Задания» открывается сразу): силуэт строк, а не «пусто». */
  loading?: boolean;
}

// Полный список заданий — один на «Задания» (Ещё) и «Все цели» (Практика). QA 2026-11 (A-З8): строка — общий TaskRow
// (открывает задание, у «Своего задания» — «Готово»). b20: шапка — лист «задания» (небо 240 + Check из ENTITY_LOOK),
// на компьютере — разворотом слева, на телефоне — полосой сверху; список — группами, как на «Практиках»; пусто — тот
// же лист крупно с подписью и одной кнопкой. Открыть задание и «+ Поставить цель» — сначала снять свою запись
// истории (goBack(then)): трекер и дневники лежат ниже оверлея (z-index 80 < 200).
export function AllTasksOverlay({ title, tasks, taskHistory, onClose, onOpen, onComplete, onAdd, error = false, loading = false }: Props) {
  const goBack = useHistorySheet(onClose);
  const phone = useIsMobile();
  const tr = useTr();
  // Местный день человека: с ним сравнивается срок, который поставил терапевт (№25).
  const today = todayStr();
  const empty = !loading && tasks.length === 0 && taskHistory.length === 0;
  const add = (
    <button type="button" className="ds-btn ds-btn--lg sk-wide-btn" onClick={() => goBack(onAdd)}>
      + Поставить цель
    </button>
  );
  if (empty) {
    return (
      <OverlayFrame onBack={goBack}>
        <div className="sk-tasks-empty">
          <EntitySheet look="task" title={title} titleAs="h1"
            sub={tr('Поставь цель и иди к ней маленькими шагами.', 'Поставьте цель и идите к ней маленькими шагами.')} />
          {error && <TaskSaveError />}
          {add}
        </div>
      </OverlayFrame>
    );
  }
  return (
    <OverlayFrame onBack={goBack}>
      <SpreadLayout className="sk-tasks-spread" side={<><EntitySheet look="task" title={title} titleAs="h1" />{add}</>}>
        {error && <TaskSaveError />}
        {loading
          ? <div aria-hidden="true"><SkeletonList rows={4} height={68} /></div>
          : <TaskListGroups groups={groupTasks(tasks, taskHistory)} today={today} phone={phone}
              onOpen={t => goBack(() => onOpen(t))} onComplete={onComplete} />}
      </SpreadLayout>
    </OverlayFrame>
  );
}
