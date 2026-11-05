import { useEffect, useRef, useState } from 'react';
import { TaskCreateSheet } from '../../components/TaskCreateSheet';
import { AllTasksOverlay } from '../today/AllTasksOverlay';
import { TaskExerciseHost } from '../today/TaskExerciseHost';
import { useTaskActions } from '../today/useTaskActions';
import { useTaskLauncher } from '../today/useTaskLauncher';

interface Props {
  onClose: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
  refreshKey?: number;
  onTasksChanged?: () => void;
}

// Узел заданий: список всех заданий (от терапевта и свои цели), запуск
// упражнения по типу задания, отметка «Готово», новая цель. Жил на главной
// (блок «Задания» + «Все задания»); владелец 2026-11-05: «на экране только
// 3 кнопки и больше ничего» — переехал на «Ещё» строкой «Задания».
// Список снимает свою запись истории до открытия упражнения или новой цели
// (goBack(then) в AllTasksOverlay): пока они открыты, списка нет; закрылись —
// список возвращается. Список закрыт рукой («Назад») и ничего не открыто — узел
// закрывается сам.
export function TasksHub({ onClose, onOpenTracker, onOpenDiaries, onOpenChildhoodWheel, refreshKey, onTasksChanged }: Props) {
  const { tasks, taskHistory, completeTask, afterCreate } = useTaskActions(refreshKey);
  const [listOpen, setListOpen] = useState(true);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const launcher = useTaskLauncher({ onOpenDiaries, onOpenTracker, onOpenChildhoodWheel, onTaskDone: id => completeTask(id, onTasksChanged) });
  const busy = !!launcher.open || showTaskCreate;
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) { wasBusy.current = false; setListOpen(true); return; }
    wasBusy.current = busy;
    if (!listOpen && !busy) onClose();
  }, [busy, listOpen, onClose]);
  return (
    <>
      {listOpen && (
        <AllTasksOverlay
          title="Задания"
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setListOpen(false)}
          onOpen={launcher.openTask}
          onComplete={task => completeTask(task.id, onTasksChanged)}
          onAdd={() => setShowTaskCreate(true)}
        />
      )}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => { setShowTaskCreate(false); afterCreate(onTasksChanged); }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      <TaskExerciseHost open={launcher.open} onBack={launcher.close} onComplete={launcher.complete} onOpenTracker={onOpenTracker} backLabel="Назад" />
    </>
  );
}
