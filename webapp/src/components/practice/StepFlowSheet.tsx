// Пошаговый лист сайта: своя оболочка (BottomSheetShell + useHistorySheet —
// иначе «Назад» браузера увела бы из приложения) + общее тело
// shared/practices/StepFlowBody. Парный по смыслу с
// schema-miniapp/src/components/StepFlowSheet.tsx: тело одно на обе площадки
// (правило №3), различается только шит — ровно как у ShareCardSheet.
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { BottomSheetShell } from '../BottomSheetShell';
import {
  StepFlowBody,
  type StepFlowProps,
} from '../../../../shared/src/practices/StepFlowBody';

export function StepFlowSheet({ onClose, ...rest }: StepFlowProps) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={300}>
      {/* Кнопка «Закрыть» внутри тела ведёт через goBack, а не onClose —
          иначе лист закрылся бы, а запись в истории осталась. */}
      <StepFlowBody {...rest} onClose={goBack} />
    </BottomSheetShell>
  );
}
