import type { ClientDetail } from '../clientSheetTypes';
import { ConceptModeCard } from './ConceptModeCard';
import { ConceptPickCard } from './ConceptPickCard';
import { SelectedSchemas } from './ConceptSelected';
import { ConceptSchemaPicker } from '../../../../../shared/src/therapy/conceptGraph/ConceptSchemaPicker';

// Выбор актуальных схем и карта режимов (вид — карточки, в покое — только
// выбранное); onGoToGraph — переход в вид «Схема» из карточки режимов.
export function ConceptPickers({ detail, onGoToGraph }: { detail: ClientDetail; onGoToGraph?: () => void }) {
  const { activeSchemaIds, toggleSchemaId } = detail;
  return (
    <div className="tcp-pickers">
      <ConceptPickCard
        title="Актуальные схемы"
        sub={`${activeSchemaIds.length} активны из 20`}
        selected={<SelectedSchemas ids={activeSchemaIds} />}
        editor={<ConceptSchemaPicker activeIds={activeSchemaIds} onToggle={toggleSchemaId} />}
      />
      <ConceptModeCard detail={detail} onGoToGraph={onGoToGraph} />
    </div>
  );
}
