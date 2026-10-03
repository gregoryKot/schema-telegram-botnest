// Типы пошагового листа «Здесь и сейчас» — общие для app- и site-вёрстки.
import type { ReactNode } from 'react';

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
}
