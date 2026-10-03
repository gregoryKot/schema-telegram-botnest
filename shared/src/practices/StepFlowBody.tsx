// Тело пошагового листа (правило «одна механика — один компонент»): шаги по
// одному, прогресс и done-экран в конце. Оболочка — своя у каждой площадки
// (BottomSheet мини-аппа против BottomSheetShell + useHistorySheet сайта,
// ровно как у ShareCardSheet), поэтому здесь только внутренность.
// Логика шагов одна; вёрстка — два представления: 'app' (StepFlowAppView,
// мини-апп) и 'site' (StepFlowSiteView, editorial). Жило в
// schema-miniapp/src/components/StepFlowSheet.tsx, пока практики были только
// в мини-аппе.
import { useState, type ReactNode } from 'react';
import { StepFlowAppView } from './StepFlowAppView';
import { StepFlowSiteView } from './StepFlowSiteView';

export interface FlowStep {
  emoji: string;
  title: string;
  hint: string;
}

/** Пропсы пошагового листа площадки — общий тип, чтобы QuickPracticeFlow мог
 * принять сам лист инъекцией (как ShareCardSheet в MonthShareButton). */
export interface StepFlowProps {
  title: string;
  subtitle: string;
  steps: FlowStep[];
  done: FlowStep;
  repeatLabel?: string;
  /** Рендерится под hint на done-экране (счётчик прохождений, «Поделиться» и т.п.) */
  doneExtra?: ReactNode;
  onClose: () => void;
  /** Вёрстка: 'app' — мини-апп (по умолчанию), 'site' — editorial сайта. */
  variant?: 'app' | 'site';
}

/** Что StepFlowBody отдаёт представлению: данные + состояние шага. */
export interface StepFlowViewProps extends Omit<StepFlowProps, 'variant'> {
  step: number;
  isDone: boolean;
  cur: FlowStep;
  nextLabel: string;
  onNext: () => void;
}

export function StepFlowBody({
  repeatLabel = 'Ещё круг',
  variant = 'app',
  ...rest
}: StepFlowProps) {
  const { steps, done } = rest;
  const [step, setStep] = useState(0);
  const isDone = step >= steps.length;
  const view: StepFlowViewProps = {
    ...rest,
    step,
    isDone,
    cur: isDone ? done : steps[step],
    nextLabel: isDone
      ? repeatLabel
      : step === steps.length - 1
        ? 'Готово'
        : 'Дальше',
    onNext: () => (isDone ? setStep(0) : setStep((s) => s + 1)),
  };
  return variant === 'site' ? (
    <StepFlowSiteView {...view} />
  ) : (
    <StepFlowAppView {...view} />
  );
}
