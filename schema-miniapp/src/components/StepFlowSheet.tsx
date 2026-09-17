// Пошаговый лист мини-аппа: своя оболочка (BottomSheet с порталом, ручкой и
// подсказкой закрытия) + общее тело shared/practices/StepFlowBody. Тело стало
// общим при переносе «Здесь и сейчас» на сайт (правило №3): шаги, точки
// прогресса и done-экран у площадок одинаковые, различается только шит —
// ровно как у ShareCardSheet. Поведение и стили не менялись.
import { BottomSheet } from './BottomSheet';
import {
  StepFlowBody,
  type StepFlowProps,
} from '../../../shared/src/practices/StepFlowBody';

export type { FlowStep } from '../../../shared/src/practices/StepFlowBody';

export function StepFlowSheet(props: StepFlowProps) {
  return (
    <BottomSheet onClose={props.onClose} zIndex={200}>
      <StepFlowBody {...props} />
    </BottomSheet>
  );
}
