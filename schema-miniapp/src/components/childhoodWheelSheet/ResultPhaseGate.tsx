import { SkeletonLines } from '../Skeleton';
import { SaveErrorNote } from '../SaveErrorNote';
import { ResultPhase } from './ResultPhase';
import type { ActiveSchema, NeedId, NeedMetaEntry, Ratings } from './types';

// Экран результата колеса детства — вынесен из ChildhoodWheelSheet.tsx
// (правило №10). Пока запрос сохранённых ответов не подтверждён — скелетон,
// не рисуем нейтральный дефолт-старт («5») как будто это реальный ответ.
export function ResultPhaseGate({
  loaded,
  loadError,
  NEED_META,
  ratings,
  onEdit,
  onDone,
  onOpenSchemas,
  setActiveSchema,
}: {
  loaded: boolean;
  loadError: boolean;
  NEED_META: Record<NeedId, NeedMetaEntry>;
  ratings: Ratings;
  onEdit: () => void;
  onDone: () => void;
  onOpenSchemas: () => void;
  setActiveSchema: (s: ActiveSchema) => void;
}) {
  if (!loaded) return <SkeletonLines widths={['70%', '90%', '55%']} />;
  return (
    <>
      {loadError && (
        <SaveErrorNote
          ty="Не удалось загрузить сохранённый результат — числа ниже могут быть неточными."
          vy="Не удалось загрузить сохранённый результат — числа ниже могут быть неточными."
        />
      )}
      <ResultPhase
        NEED_META={NEED_META}
        ratings={ratings}
        onEdit={onEdit}
        onDone={onDone}
        onOpenSchemas={onOpenSchemas}
        setActiveSchema={setActiveSchema}
      />
    </>
  );
}
