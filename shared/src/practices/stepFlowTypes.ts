// Типы пошагового листа «Здесь и сейчас» (заземление, «Стоп») — контракт между общей рамкой
// QuickPracticeFlow и вёрсткой площадки (StepFlowSheet сайта).
import type { ReactNode } from 'react';
import type {
  QuickPracticeId,
  QuickPracticeStep,
  QuickStepCounter,
} from './quickPractices';

export type FlowStep = QuickPracticeStep;

/** Пропсы пошагового листа площадки — общий тип, чтобы QuickPracticeFlow мог
 * принять сам лист инъекцией (как ShareCardSheet в MonthShareButton). */
export interface StepFlowProps {
  /** Практика: её бумага, знак и сцена «готово» — ENTITY_LOOK[id]. */
  id: QuickPracticeId;
  title: string;
  subtitle: string;
  steps: FlowStep[];
  done: FlowStep;
  counter?: QuickStepCounter;
  repeatLabel?: string;
  /** Рендерится под hint на done-экране (счётчик прохождений, «Поделиться» и т.п.) */
  doneExtra?: ReactNode;
  /** Под кнопками первого шага — предупреждение площадки (тише самого шага). */
  note?: ReactNode;
  onClose: () => void;
}
