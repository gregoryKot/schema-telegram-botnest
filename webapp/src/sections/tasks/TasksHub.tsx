import { useEffect, useRef, useState } from 'react';
import { TaskCreateSheet } from '../../components/TaskCreateSheet';
import { AllTasksOverlay } from '../today/AllTasksOverlay';
import { TaskExerciseHost } from '../today/TaskExerciseHost';
import { useTaskActions } from '../today/useTaskActions';
import { useTaskLauncher } from '../today/useTaskLauncher';
import { markTasksSeen } from './newTasks';
import { taskToOpen } from './tasksLaunch';

interface Props {
  onClose: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  onOpenChildhoodWheel: () => void;
  refreshKey?: number;
  onTasksChanged?: () => void;
  /** Ссылка из уведомления (`tasks_<id>`): открыть это задание, а не список. */
  openTaskId?: number;
}

// Узел заданий: список всех заданий (от терапевта и свои цели), запуск
// упражнения по типу задания, отметка «Готово», новая цель. Жил на главной
// (блок «Задания» + «Все задания»); владелец 2026-11-05: «на экране только
// 3 кнопки и больше ничего» — переехал на «Ещё» строкой «Задания».
// Список снимает свою запись истории до открытия упражнения или новой цели
// (goBack(then) в AllTasksOverlay): пока они открыты, списка нет; закрылись —
// список возвращается. Список закрыт рукой («Назад») и ничего не открыто — узел
// закрывается сам. По ссылке с заданием список ждёт загрузки: задание с листом
// открывается сразу, остальные — списком (tasksLaunch.taskToOpen).
export function TasksHub({ onClose, onOpenTracker, onOpenDiaries, onOpenChildhoodWheel, refreshKey, onTasksChanged, openTaskId }: Props) {
  // taskError — отказ «Готово» или новой цели: до 2026-11 узел его не показывал, сбой проходил молча.
  const { tasks, taskHistory, taskError, loaded, completeTask, afterCreate } = useTaskActions(refreshKey);
  // Задание из ссылки ждёт загрузки списка; решение принимается один раз (ref), пока ждём — узел «занят».
  const pendingId = useRef(openTaskId ?? null);
  const [waiting, setWaiting] = useState(openTaskId !== undefined);
  const [listOpen, setListOpen] = useState(openTaskId === undefined);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const launcher = useTaskLauncher({ onOpenDiaries, onOpenTracker, onOpenChildhoodWheel, onTaskDone: id => completeTask(id, onTasksChanged) });
  const { openTask } = launcher;
  const busy = !!launcher.open || showTaskCreate || waiting;
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) { wasBusy.current = false; setListOpen(true); return; }
    wasBusy.current = busy;
    if (!listOpen && !busy) onClose();
  }, [busy, listOpen, onClose]);
  useEffect(() => {
    const id = pendingId.current;
    if (id === null || !loaded) return;
    pendingId.current = null;
    const task = taskToOpen(tasks, id);
    if (task) openTask(task);
    else setListOpen(true);
    setWaiting(false);
  }, [loaded, tasks, openTask]);
  // Что лежит в узле, человек увидел: счётчик «новых» на «Ещё» гаснет.
  useEffect(() => { markTasksSeen(tasks); }, [tasks]);
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
          error={taskError} loading={!loaded}
        />
      )}
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => { setShowTaskCreate(false); void afterCreate(onTasksChanged); /* сбой ловит сам: taskError */ }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      <TaskExerciseHost open={launcher.open} onBack={launcher.close} onComplete={launcher.complete} onOpenTracker={onOpenTracker} backLabel="Назад" />
    </>
  );
}
