// Логика пошагового листа — одна на обе вёрстки (StepFlowBody мини-аппа и
// StepFlowSiteBody сайта, правило «одна механика — один компонент»): текущий
// шаг, done-экран, подпись главной кнопки, переход вперёд/сначала.
import { useState } from 'react';
import type { FlowStep } from './stepFlowTypes';

export function useStepFlow(
  steps: FlowStep[],
  done: FlowStep,
  repeatLabel = 'Ещё круг',
) {
  const [step, setStep] = useState(0);
  const isDone = step >= steps.length;
  const cur: FlowStep = isDone ? done : steps[step];
  const nextLabel = isDone
    ? repeatLabel
    : step === steps.length - 1
      ? 'Готово'
      : 'Дальше';
  const onNext = () => (isDone ? setStep(0) : setStep((s) => s + 1));
  return [step, isDone, cur, nextLabel, onNext] as const;
}
