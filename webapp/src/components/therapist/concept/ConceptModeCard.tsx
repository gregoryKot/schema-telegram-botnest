import { ConceptModePicker } from '../../../../../shared/src/therapy/conceptGraph/ConceptModePicker';
import { ModeSchemasList } from '../../../../../shared/src/therapy/conceptGraph/ModeSchemasList';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptPickCard } from './ConceptPickCard';
import { SelectedModes } from './ConceptSelected';

// «Карта режимов» вида «Поля»: выбранные режимы (весь перечень — по «Изменить»)
// и схемы за ними из modeLinks (черновик сильнее сервера, #879); связи здесь
// только читаются, правятся в виде «Схема» (onGoToGraph).
export function ConceptModeCard({ detail, onGoToGraph }: { detail: ClientDetail; onGoToGraph?: () => void }) {
  const { activeModeIds, toggleModeId, localConcept, concept } = detail;
  return (
    <ConceptPickCard
      title="Карта режимов"
      sub={`${activeModeIds.length} в работе`}
      hasSelection={activeModeIds.length > 0}
      selected={<SelectedModes ids={activeModeIds} />}
      editor={<ConceptModePicker activeModeIds={activeModeIds} onToggle={toggleModeId} />}
    >
      <ModeSchemasList activeModeIds={activeModeIds} modeLinks={localConcept.modeLinks ?? concept?.modeLinks} onGoToGraph={onGoToGraph} />
    </ConceptPickCard>
  );
}
