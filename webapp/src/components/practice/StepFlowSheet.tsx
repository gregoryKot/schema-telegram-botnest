// Пошаговый лист сайта (заземление, «Стоп»): своя оболочка (BottomSheetShell + useHistorySheet —
// иначе «Назад» браузера увела бы из приложения) + вёрстка QuickStepBody на общей логике шагов
// (shared/practices/useStepFlow). Контент и запись прохождения — QuickPracticeFlow.
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { BottomSheetShell } from '../BottomSheetShell';
import { QuickStepBody } from './QuickStepBody';
import type { StepFlowProps } from '../../../../shared/src/practices/stepFlowTypes';

export function StepFlowSheet({ onClose, ...rest }: StepFlowProps) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={300} maxWidth={560} label={rest.title}>
      {/* «Закрыть» внутри тела ведёт через goBack, а не onClose — иначе лист закрылся бы,
          а запись в истории осталась. */}
      <QuickStepBody {...rest} onClose={goBack} />
    </BottomSheetShell>
  );
}
