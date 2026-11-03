import { useEffect, useRef, useState } from 'react';
import {
  useHelpOverlays,
  type HelpOverlayId,
} from './helpSection/useHelpOverlays';
import { HelpOverlays } from './helpSection/HelpOverlays';
import { HereAndNow } from './helpSection/HereAndNow';
import { useSafeTop } from '../utils/safezone';
import { TherapyNote } from '../components/TherapyNote';
// Из общего реестра ключей, не из ChildhoodWheelSheet.tsx (компонент теперь
// ленивый, LazyOverlays.tsx) — иначе открытие «Помощи» тянуло бы за собой и
// код колеса детства ещё до того, как его реально открыли.
import { CHILDHOOD_DONE_KEY } from '../utils/storageKeys';
import { TaskCreateSheet } from '../components/TaskCreateSheet';
import { api, UserTask, TherapyRelationInfo } from '../api';
import { TaskRow } from '../components/tasks/TaskRow';
import {
  completesOnSave,
  taskRoute,
  type TaskExercise,
} from '../../../shared/src/tasks/taskRoute';
import type { QuickPracticeId } from '../../../shared/src/practices/quickPractices';
import { AllTasksSheet } from './helpSection/AllTasksSheet';
import { HelpHeader } from './helpSection/HelpHeader';
import { ToolsList } from './helpSection/ToolsList';

const EXERCISE_OVERLAY: Record<TaskExercise, HelpOverlayId> = {
  belief_check: 'beliefCheck',
  letter_to_self: 'letterToSelf',
  safe_place: 'safePlace',
  flashcard: 'flashcard',
};

interface Props {
  onOpenChildhoodWheel: () => void;
  onOpenPractices: () => void;
  onOpenPlans: () => void;
  onOpenTracker: () => void;
  onOpenDiaries: () => void;
  practiceCount?: number | null;
  planCount?: number | null;
  refreshKey?: number;
  initialTasks?: UserTask[] | null;
  onTasksChanged?: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

export function HelpSection({
  onOpenChildhoodWheel,
  onOpenPractices,
  onOpenPlans,
  onOpenTracker,
  onOpenDiaries,
  practiceCount,
  planCount,
  refreshKey,
  initialTasks,
  onTasksChanged,
}: Props) {
  const safeTop = useSafeTop();
  const childhoodDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);
  const customizeOpenRef = useRef<() => void>(() => {});

  const overlays = useHelpOverlays();
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [tasks, setTasks] = useState<UserTask[]>(initialTasks ?? []);
  const [taskHistory, setTaskHistory] = useState<UserTask[]>([]);
  const [relation, setRelation] = useState<
    TherapyRelationInfo | null | undefined
  >(initialTasks !== undefined ? null : undefined);
  const [practiceCounts, setPracticeCounts] = useState<Record<
    QuickPracticeId,
    number
  > | null>(null);

  useEffect(() => {
    if (initialTasks !== undefined) setTasks(initialTasks ?? []);
  }, [initialTasks]);

  // Один общий запрос счётчиков на секцию — не по хуку на каждую строку.
  useEffect(() => {
    let ignore = false;
    api
      .getPracticeSessions()
      .then((c) => {
        if (!ignore) setPracticeCounts(c);
      })
      .catch((e) => console.error('getPracticeSessions failed', e));
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => {
        if (!ignore) {
          setTasks(t);
          setTaskHistory(h);
        }
      })
      .catch((e) => console.error('getTasks/getTaskHistory failed', e));
    api
      .getTherapyRelation()
      .then((r) => {
        if (!ignore) setRelation(r);
      })
      .catch(() => {
        if (!ignore) setRelation(null);
      });
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const therapistTasks = tasks.filter((t) => t.assignedBy !== null);

  // Куда ведёт задание — общий маршрут с «Сегодня» и «Практикой» сайта
  // (shared/taskRoute); здесь только оверлеи мини-аппа.
  function openTask(task: UserTask) {
    setShowAllTasks(false);
    const route = taskRoute(task);
    setActiveTaskId(completesOnSave(route) ? task.id : null);
    switch (route.kind) {
      case 'diary':
        return onOpenDiaries();
      case 'tracker':
        return onOpenTracker();
      case 'childhood_wheel':
        return onOpenChildhoodWheel();
      case 'exercise':
        return overlays.show(EXERCISE_OVERLAY[route.exercise]);
      case 'schema':
        if (route.id) overlays.setIntroSchemaId(route.id);
        return;
      case 'mode':
        if (route.id) overlays.setIntroModeId(route.id);
        return;
    }
  }

  // Общий рефетч списка задач — раньше три копии этого Promise.all глушили
  // ошибку по отдельности молча; теперь один центр логирования.
  function refreshTasks() {
    return Promise.all([api.getTasks(), api.getTaskHistory()])
      .then(([t, h]) => {
        setTasks(t);
        setTaskHistory(h);
        onTasksChanged?.();
      })
      .catch((e) => console.error('refreshTasks failed', e));
  }

  function completeTask(taskId: number) {
    api
      .completeTask(taskId, true)
      .then(() => refreshTasks())
      .catch((e) => console.error('completeTask failed', e));
  }

  function handleTaskComplete() {
    if (activeTaskId === null) return;
    const taskId = activeTaskId;
    setActiveTaskId(null);
    completeTask(taskId);
  }

  return (
    <div
      className="section-pad"
      style={{
        paddingTop: safeTop,
        animation: 'fade-in 0.25s ease',
        overflowX: 'hidden',
      }}
    >
      <HelpHeader
        relation={relation}
        onOpenSelfHelp={() => overlays.show('selfHelp')}
        onOpenCustomize={() => customizeOpenRef.current()}
      />

      <div
        style={{
          padding: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-12)',
        }}
      >
        <HereAndNow overlays={overlays} practiceCounts={practiceCounts} />

        {/* Therapist tasks — shown prominently when assigned */}
        {therapistTasks.filter((t) => !t.doneToday).length > 0 && (
          <div
            style={{
              background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
              borderRadius: 18,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 10,
              }}
            >
              От терапевта
            </div>
            {therapistTasks
              .filter((t) => !t.doneToday)
              .map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={() => openTask(task)}
                  onComplete={() => completeTask(task.id)}
                />
              ))}
          </div>
        )}

        {/* Инструменты — iOS-строки по макету, каскадное появление */}
        <ToolsList
          tasksCount={tasks.length}
          practiceCount={practiceCount}
          planCount={planCount}
          childhoodDone={childhoodDone}
          onOpenTasks={() => setShowAllTasks(true)}
          onOpenPractices={onOpenPractices}
          onOpenPlans={onOpenPlans}
          onOpenBeliefCheck={() => overlays.show('beliefCheck')}
          onOpenPhraseCheck={() => overlays.show('phraseCheck')}
          onOpenSafePlace={() => overlays.show('safePlace')}
          onOpenLetterToSelf={() => overlays.show('letterToSelf')}
          onOpenFlashcard={() => overlays.show('flashcard')}
          onOpenChildhoodWheel={onOpenChildhoodWheel}
          onOpenWarmWords={() => overlays.show('warmWords')}
          customizeOpenRef={customizeOpenRef}
        />

        <div style={{ paddingBottom: 4 }}>
          <TherapyNote compact />
        </div>
      </div>

      <HelpOverlays
        overlays={overlays}
        onTaskComplete={handleTaskComplete}
        onOpenTracker={onOpenTracker}
      />
      {showTaskCreate && (
        <TaskCreateSheet
          onCreated={() => {
            setShowTaskCreate(false);
            void refreshTasks();
          }}
          onClose={() => setShowTaskCreate(false)}
        />
      )}
      {showAllTasks && (
        <AllTasksSheet
          tasks={tasks}
          taskHistory={taskHistory}
          onClose={() => setShowAllTasks(false)}
          onOpenTask={openTask}
          onReload={() => refreshTasks()}
          onAdd={() => {
            setShowAllTasks(false);
            setShowTaskCreate(true);
          }}
        />
      )}
    </div>
  );
}
