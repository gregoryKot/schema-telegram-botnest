// Контент трёх быстрых практик экрана «Здесь и сейчас» (дыхание, заземление
// 5-4-3-2-1, техника «Стоп») — общий источник для листа-практики и карточки
// шаринга (правило №3 CLAUDE.md: один контент вместо двух копий, которые
// разъедутся при правке). stop/grounding — quickPracticeSteps.ts.
// breathing — новый контент по фактической механике
// удалённого мини-аппа: BREATH_IN_S=4, BREATH_HOLD_S=4,
// BREATH_OUT_S=6 (вдох 4 — задержка 4 — выдох 6, отсюда «Дыхание 4-4-6»).
// Вид практики (бумага, знак, сцена «готово») — ENTITY_LOOK[id] (shared/src/theme/entityLook.ts):
// id практики и есть ключ таблицы. Дыхание на сайте идёт живым листом (BreathingCard), его шаги
// здесь — контент карточки шаринга.
import { buildGrounding, buildStop } from './quickPracticeSteps';

export type QuickPracticeId = 'breathing' | 'grounding' | 'stop';

export interface QuickPracticeStep {
  emoji: string;
  /** Число или буква шага крупно (5…1, С-Т-О-П) — тот же знак, что в начале заголовка шага. */
  mark?: string;
  title: string;
  hint: string;
}

/** Счётчик шагов на листе: камешки от большого к малому (5-4-3-2-1) или буквы акронима. */
export type QuickStepCounter = 'pebbles' | 'letters';

export interface QuickPractice {
  id: QuickPracticeId;
  /** Эмодзи практики для карточки/строки */
  emoji: string;
  /** «Техника «Стоп»» */
  title: string;
  // Нейтральная строка «зачем это» — вилки ты/вы в ней нет
  subtitle: string;
  steps: QuickPracticeStep[];
  counter?: QuickStepCounter;
  /** Финальный экран после последнего шага */
  done: QuickPracticeStep;
}

export type Tr = (ty: string, vy: string) => string;

function buildBreathing(tr: Tr): QuickPractice {
  return {
    id: 'breathing',
    emoji: '🌬',
    title: 'Дыхание 4-4-6',
    subtitle:
      'Вдох короче выдоха — так тело получает сигнал, что опасности нет',
    steps: [
      {
        emoji: '🌬️',
        title: tr('Вдохни на 4 счёта', 'Вдохните на 4 счёта'),
        hint: 'Медленно, через нос — грудная клетка наполняется воздухом.',
      },
      {
        emoji: '⏸️',
        title: tr('Задержи дыхание на 4 счёта', 'Задержите дыхание на 4 счёта'),
        hint: 'Без напряжения — просто пауза перед выдохом.',
      },
      {
        emoji: '💨',
        title: tr('Выдохни на 6 счётов', 'Выдохните на 6 счётов'),
        hint: 'Долгий и плавный — самая важная часть цикла для нервной системы.',
      },
    ],
    done: {
      emoji: '🫧',
      title: tr(
        'Ты дышишь ровнее, чем в начале',
        'Вы дышите ровнее, чем в начале',
      ),
      hint: 'Можно повторить ещё один круг — или просто вернуться к делам.',
    },
  };
}

const BUILDERS: Record<QuickPracticeId, (tr: Tr) => QuickPractice> = {
  breathing: buildBreathing,
  grounding: buildGrounding,
  stop: buildStop,
};

export const buildQuickPractice = (
  id: QuickPracticeId,
  tr: Tr,
): QuickPractice => BUILDERS[id](tr);

export const QUICK_PRACTICE_IDS: readonly QuickPracticeId[] = [
  'breathing',
  'grounding',
  'stop',
];
